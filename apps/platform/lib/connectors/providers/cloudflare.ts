/**
 * Cloudflare, read with an API token holding Account Settings Read, Zone Read and Zone Settings Read.
 * Docs: developers.cloudflare.com/api/resources/accounts/subresources/members/methods/list/
 */
import { call, need, result, listSome, plural } from '../http';
import { ConnectorError, type ConnectorImpl, type Credentials } from '../types';
import type { CheckResult } from '../../integrations/catalog';
import type { Account } from '../../registers/accounts';

type Envelope<T> = { success?: boolean; result: T; result_info?: { page?: number; total_pages?: number }; errors?: { message?: string }[] };
type Zone = { id: string; name: string };
type Member = {
  id: string;
  status?: string;
  // Unverified: two_factor_authentication_enabled on the member's user object.
  user?: { email?: string; first_name?: string | null; last_name?: string | null; two_factor_authentication_enabled?: boolean };
  roles?: { name?: string }[];
  policies?: { permission_groups?: { name?: string }[] }[];
};

const BASE = 'https://api.cloudflare.com/client/v4';
const SUPER = 'Super Administrator - All Privileges';

function client(c: Credentials) {
  const accountId = need(c, 'accountId', 'The account id');
  const token = need(c, 'token', 'The API token');
  async function get<T>(path: string): Promise<Envelope<T>> {
    const j = await call<Envelope<T>>(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (j.success === false) throw new ConnectorError(400, `Cloudflare said: ${j.errors?.[0]?.message ?? 'the request failed'}`);
    return j;
  }
  async function pages<T>(path: string, max: number): Promise<T[]> {
    const out: T[] = [];
    for (let page = 1; page <= max; page++) {
      const j = await get<T[]>(`${path}${path.includes('?') ? '&' : '?'}per_page=50&page=${page}`);
      out.push(...(j.result ?? []));
      if (!j.result?.length || page >= (j.result_info?.total_pages ?? page)) break;
    }
    return out;
  }
  return { accountId, get, pages };
}

const isSuper = (m: Member) => (m.roles ?? []).some((r) => r.name === SUPER) || (m.policies ?? []).some((p) => (p.permission_groups ?? []).some((g) => g.name === SUPER));
const status = (e: unknown) => (e as { status?: number }).status;

export const cloudflare: ConnectorImpl = {
  async run(c) {
    const { accountId, get, pages } = client(c);
    let label = accountId;
    try {
      label = (await get<{ name?: string }>(`/accounts/${accountId}`)).result?.name || accountId;
    } catch (e) {
      if (status(e) !== 403 && status(e) !== 404) throw e;
    }
    const subject = label;
    const results: CheckResult[] = [];

    // Zones: TLS 1.2 or newer, Always Use HTTPS on, and SSL not off or Flexible.
    try {
      const zones = (await pages<Zone>(`/zones?account.id=${encodeURIComponent(accountId)}`, 10)).slice(0, 50);
      const weak: string[] = [];
      let read = 0;
      for (const z of zones) {
        const setting = async (name: string) => {
          try { return String((await get<{ value?: unknown }>(`/zones/${z.id}/settings/${name}`)).result?.value ?? ''); } catch (e) { if (status(e) === 403 || status(e) === 404) return null; throw e; }
        };
        const [tls, https, ssl] = [await setting('min_tls_version'), await setting('always_use_https'), await setting('ssl')];
        if (tls === null && https === null && ssl === null) continue;
        read++;
        const why: string[] = [];
        if (tls && parseFloat(tls) < 1.2) why.push(`TLS ${tls} allowed`);
        if (https === 'off') why.push('HTTPS not forced');
        if (ssl === 'off' || ssl === 'flexible') why.push(`SSL mode ${ssl}`);
        if (why.length) weak.push(`${z.name} (${why.join(', ')})`);
      }
      results.push(!zones.length
        ? result('cloudflare.tls_enforced', subject, 'unknown', 'Cloudflare returned no zones for this account.')
        : !read
          ? result('cloudflare.tls_enforced', subject, 'unknown', 'AIC could not read zone settings. The token may need Zone Settings Read.')
          : weak.length
            ? result('cloudflare.tls_enforced', subject, 'fail', `${plural(weak.length, 'zone')} with weak encryption settings: ${listSome(weak)}.`, { zones: weak })
            : result('cloudflare.tls_enforced', subject, 'pass', `All ${plural(read, 'zone')} force HTTPS with TLS 1.2 or newer.`));
    } catch (e) {
      if (status(e) === 401) throw e;
      results.push(result('cloudflare.tls_enforced', subject, 'unknown', `Could not read zones: ${(e as Error).message}`));
    }

    // Members: two-factor sign-in and no more than three super administrators.
    try {
      const members = (await pages<Member>(`/accounts/${accountId}/members`, 10)).filter((m) => m.status === 'accepted');
      const emailOf = (m: Member) => m.user?.email ?? m.id;
      const reported = members.filter((m) => typeof m.user?.two_factor_authentication_enabled === 'boolean');
      const no2fa = reported.filter((m) => m.user?.two_factor_authentication_enabled === false).map(emailOf);
      const supers = members.filter(isSuper).map(emailOf);
      const problems: string[] = [];
      if (no2fa.length) problems.push(`${plural(no2fa.length, 'member')} without two-factor sign-in: ${listSome(no2fa)}.`);
      if (supers.length > 3) problems.push(`${plural(supers.length, 'super administrator')}: ${listSome(supers)}. Keep it to 3 or fewer.`);
      const adminLine = `${plural(supers.length, 'super administrator')}.`;
      results.push(!members.length
        ? result('cloudflare.members_mfa', subject, 'unknown', 'AIC could not see any account members.')
        : problems.length
          ? result('cloudflare.members_mfa', subject, 'fail', problems.join(' '), { without2fa: no2fa, superAdmins: supers })
          : !reported.length
            ? result('cloudflare.members_mfa', subject, 'unknown', `Cloudflare did not say whether members use two-factor sign-in. There ${supers.length === 1 ? 'is' : 'are'} ${adminLine}`, { superAdmins: supers })
            : result('cloudflare.members_mfa', subject, 'pass', `All ${plural(reported.length, 'member')} use two-factor sign-in, with ${adminLine}`, { superAdmins: supers }));
    } catch (e) {
      if (status(e) === 401) throw e;
      results.push(result('cloudflare.members_mfa', subject, 'unknown', `Could not read account members: ${(e as Error).message}`));
    }

    return { results, label };
  },

  async accounts(c) {
    const { accountId, pages } = client(c);
    const members = await pages<Member>(`/accounts/${accountId}/members`, 10);
    return members.map((m): Account => ({
      system: 'Cloudflare', account: m.user?.email ?? m.id,
      displayName: [m.user?.first_name, m.user?.last_name].filter(Boolean).join(' ') || null,
      privilege: m.roles?.[0]?.name ?? null, lastActiveAt: null, enabled: m.status === 'accepted',
    }));
  },
};
