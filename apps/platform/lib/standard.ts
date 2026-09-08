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

const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL ?? 'https://aiccertified.cloud';
const CACHE_TTL_MS = 15 * 60_000;

let cache: { at: number; standard: PublishedStandard } | null = null;

/**
 * Fetches the published standard, with a short in-process cache and a hard
 * timeout. Throws rather than returning a partial or invented standard: seeding
 * an organisation with requirements that are not the published ones is the
 * failure this whole module exists to end.
 */
export async function fetchPublishedStandard(): Promise<PublishedStandard> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.standard;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const res = await fetch(`${WEB_URL}/api/standard`, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`standard endpoint returned ${res.status}`);

    const data = (await res.json()) as PublishedStandard;
    if (!data?.version || !Array.isArray(data.requirements) || data.requirements.length === 0) {
      throw new Error('standard endpoint returned no requirements');
    }

    cache = { at: Date.now(), standard: data };
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

/** The requirements that actually apply to a Division. */
export function requirementsForDivision(
  standard: PublishedStandard,
  division: number
): PublishedRequirement[] {
  return standard.requirements.filter((r) => r.divisions.includes(division));
}
