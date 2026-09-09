/**
 * The published standard, fetched from where it is published.
 *
 * aic-web owns the standard: it serves 44 requirements at /api/standard with a
 * version and issue date, each requirement carrying its code, the Right it
 * serves, the text, the evidence required, its evidence tier and the Divisions
 * it applies to. The platform deliberately does not keep a second copy — a
 * certification body with two versions of its own standard has none.
 *
 * Before this existed, signup seeded eight hand-written requirements whose text
 * appeared in no published document, for an organisation whose Division was
 * never asked.
 */

export type RightCode = 'HU' | 'EX' | 'EM' | 'CO' | 'TR';

export interface PublishedRequirement {
  code: string;
  right: RightCode;
  text: string;
  evidence: string;
  tier: string;
  divisions: number[];
  flagship?: boolean;
}

export interface PublishedStandard {
  version: string;
  issued: string;
  requirements: PublishedRequirement[];
  /**
   * The five Rights, named. Optional because an older aic-web deploy may not
   * serve it yet — in which case the UI falls back to showing the bare code
   * (HU, EX, …). Deliberately no local copy of the names: an invented label is
   * worse than a terse one.
   */
  rights?: Partial<Record<RightCode, { name: string; blurb: string }>>;
}

/** 1 Sovereign … 5 Artificial. Modes of operation, not grades. */
export const DIVISIONS: Record<number, { name: string; tagline: string; who: string }> = {
  1: {
    name: 'Sovereign',
    tagline: 'We make decisions. Humans make them.',
    who: 'No AI is used in consequential decisions.',
  },
  2: {
    name: 'Supervised',
    tagline: 'AI assists. Humans decide.',
    who: 'AI recommends; a named human makes every consequential decision.',
  },
  3: {
    name: 'Reviewed',
    tagline: 'AI decides. Humans review patterns and cases.',
    who: 'AI makes operational decisions; humans review periodically and investigate flagged cases.',
  },
  4: {
    name: 'Monitored',
    tagline: 'AI decides at scale. Humans monitor the system.',
    who: 'AI decides at volume; humans oversee aggregate behaviour rather than individual decisions.',
  },
  5: {
    name: 'Artificial',
    tagline: 'We build what others decide with.',
    who: 'Builders and vendors, whose accountability runs upstream to their customers’ decisions.',
  },
};

export const isValidDivision = (d: unknown): d is number =>
  typeof d === 'number' && Number.isInteger(d) && d >= 1 && d <= 5;

const PUBLIC_WEB_URL = 'https://aiccertified.cloud';

/**
 * Where to fetch the standard from, in order of preference.
 *
 * NEXT_PUBLIC_WEB_URL is honoured, but ignored in production when it points at
 * localhost: .env.example ships `NEXT_PUBLIC_WEB_URL=http://localhost:3000`,
 * and an environment seeded from that file would send this container looking
 * for the standard on its own loopback interface, where nothing is listening.
 * That is not a hypothetical — the equivalent mistake with POSTGRES_URL vs
 * DATABASE_URL took signup down for a day.
 *
 * Both candidates are tried before giving up, so a misconfigured variable
 * degrades to the public URL rather than taking registration with it.
 */
function candidateUrls(): string[] {
  const urls: string[] = [];
  const add = (u?: string) => {
    const v = u?.trim().replace(/\/+$/, '');
    if (v && !urls.includes(v)) urls.push(v);
  };

  // Tried first, and the one that actually works in this deployment.
  //
  // aiccertified.cloud resolves to the same VPS this container runs on, and a
  // container generally cannot route out and back in through its own host's
  // public IP. That is why the public URL failed in 4ms — too fast for DNS and
  // a TLS handshake, because it never left the box. Service-to-service calls
  // belong on the internal network anyway: they are faster, they do not depend
  // on public DNS or the reverse proxy, and they keep working if either is
  // having a bad day.
  //
  // Server-only on purpose. NEXT_PUBLIC_* variables are inlined into the client
  // bundle at build time, so an internal hostname put there would both leak and
  // be frozen at build.
  add(process.env.AIC_WEB_INTERNAL_URL);

  // Then whatever the app was configured with, unless it is a loopback address
  // in production: .env.example ships NEXT_PUBLIC_WEB_URL=http://localhost:3000
  // and an environment seeded from that file would look for the standard on its
  // own loopback interface, where nothing is listening.
  const configured = process.env.NEXT_PUBLIC_WEB_URL?.trim();
  const isLoopback = !!configured && /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(configured);
  if (!(isLoopback && process.env.NODE_ENV === 'production')) add(configured);

  // Last resort. Correct from anywhere that is not this host.
  add(PUBLIC_WEB_URL);
  return urls;
}

const CACHE_TTL_MS = 15 * 60_000;
const FETCH_TIMEOUT_MS = 8_000;

let cache: { at: number; standard: PublishedStandard } | null = null;

/**
 * Fetches the published standard, with a short in-process cache and a hard
 * timeout. Throws rather than returning a partial or invented standard: seeding
 * an organisation with requirements that are not the published ones is the
 * failure this whole module exists to end.
 */
export async function fetchPublishedStandard(): Promise<PublishedStandard> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.standard;

  const attempts: string[] = [];

  for (const base of candidateUrls()) {
    const url = `${base}/api/standard`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`returned ${res.status}`);

      const data = (await res.json()) as PublishedStandard;
      if (!data?.version || !Array.isArray(data.requirements) || data.requirements.length === 0) {
        throw new Error('returned no requirements');
      }

      cache = { at: Date.now(), standard: data };
      return data;
    } catch (error) {
      // Named so the log says which URL failed and why. The previous version
      // logged only the error, which made "could not load the standard"
      // indistinguishable from a DNS failure, a 404 and a timeout.
      attempts.push(`${url} — ${(error as Error).message}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(
    `Could not load the published standard. Tried:\n  ${attempts.join('\n  ')}`
  );
}

/**
 * Whether the standard is reachable, and from where. Used by the health check
 * so this dependency can be seen before a signup discovers it.
 */
export async function standardHealth(): Promise<{ ok: boolean; version?: string; detail?: string }> {
  try {
    const s = await fetchPublishedStandard();
    return { ok: true, version: s.version };
  } catch (error) {
    return { ok: false, detail: (error as Error).message };
  }
}

/** The requirements that actually apply to a Division. */
export function requirementsForDivision(
  standard: PublishedStandard,
  division: number
): PublishedRequirement[] {
  return standard.requirements.filter((r) => r.divisions.includes(division));
}
