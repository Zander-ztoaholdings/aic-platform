/**
 * Okta, read with an SSWS API token from a Read-only Administrator.
 * Docs: developer.okta.com/docs/api/openapi/okta-management/
 */
import { call, baseUrl, need, result, adminsCheck, staleCheck, listSome, plural, providerMessage } from '../http';
import { ConnectorError, type ConnectorImpl, type Credentials } from '../types';
import type { Account } from '../../registers/accounts';

type OktaUser = { id: string; status: string; created: string; lastLogin: string | null; profile: { login: string; email?: string; firstName?: string; lastName?: string } };
type Factor = { factorType: string; status: string };
type Policy = { id: string; name: string; status: string };
type Rule = { name: string; status: string; actions?: { appSignOn?: { access?: string; verificationMethod?: { factorMode?: string } } } };
type Role = { type: string };

/** Okta pages with a Link header; follows `rel="next"` up to `max` pages. */
async function pages<T>(url: string, token: string, max = 20): Promise<T[]> {
  const out: T[] = [];
  let next: string | null = url;
  for (let i = 0; next && i < max; i++) {
    let res: Response;
    try {
      res = await fetch(next, { headers: { Authorization: `SSWS ${token}`, Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) });
    } catch (e) {
      throw new ConnectorError(0, `Could not reach ${new URL(next).host}: ${(e as Error).message}`);
    }
    if (!res.ok) throw new ConnectorError(res.status, `Okta answered ${res.status}: ${providerMessage(await res.text())}`);
    out.push(...((await res.json()) as T[]));
    next = res.headers.get('link')?.split(',').find((l) => l.includes('rel="next"'))?.match(/<([^>]+)>/)?.[1] ?? null;
  }
  return out;
}

const setup = (c: Credentials) => ({ base: `${baseUrl(need(c, 'domain', 'The Okta domain'))}/api/v1`, token: need(c, 'token', 'The API token') });
const nameOf = (u: OktaUser) => [u.profile.firstName, u.profile.lastName].filter(Boolean).join(' ') || u.profile.login;

export const okta: ConnectorImpl = {
  async run(c, ctx) {
    const { base, token } = setup(c);
    const subject = new URL(base).host;
    const get = <T>(path: string) => call<T>(`${base}${path}`, { headers: { Authorization: `SSWS ${token}` } });
    const users = (await pages<OktaUser>(`${base}/users?limit=200`, token)).filter((u) => u.status === 'ACTIVE');
    const results = [];

    // Sign-on policies: any active rule that allows access with one factor.
    try {
      const policies = (await get<Policy[]>('/policies?type=ACCESS_POLICY')).filter((p) => p.status === 'ACTIVE');
      const weak: string[] = [];
      for (const p of policies.slice(0, 30)) {
        const rules = await get<Rule[]>(`/policies/${p.id}/rules`);
        for (const r of rules) if (r.status === 'ACTIVE' && r.actions?.appSignOn?.access === 'ALLOW' && r.actions.appSignOn.verificationMethod?.factorMode === '1FA') weak.push(`${p.name}: ${r.name}`);
      }
      results.push(weak.length
        ? result('okta.mfa_enforced', subject, 'fail', `${plural(weak.length, 'sign-on rule')} let people in with one factor: ${listSome(weak)}.`, { rules: weak })
        : result('okta.mfa_enforced', subject, policies.length ? 'pass' : 'unknown', policies.length ? `All ${plural(policies.length, 'authentication policy', 'authentication policies')} require two factors.` : 'AIC could not read any authentication policies.'));
    } catch (e) {
      results.push(result('okta.mfa_enforced', subject, 'unknown', `Could not read sign-on policies: ${(e as Error).message}`));
    }

    // Factors per active user, capped so a large tenant does not take minutes.
    const sample = users.slice(0, 300);
    const without: string[] = [];
    for (const u of sample) {
      const factors = await get<Factor[]>(`/users/${u.id}/factors`);
      if (!factors.some((f) => f.status === 'ACTIVE' && f.factorType !== 'password')) without.push(nameOf(u));
    }
    results.push(without.length
      ? result('okta.users_mfa_enrolled', subject, 'fail', `${plural(without.length, 'active user')} with no second factor: ${listSome(without)}.`, { users: without })
      : result('okta.users_mfa_enrolled', subject, sample.length ? 'pass' : 'unknown', sample.length ? `All ${plural(sample.length, 'active user')}${users.length > sample.length ? ' checked' : ''} have a second factor.` : 'No active users found.'));

    // Super administrators.
    const admins: string[] = [];
    for (const u of users.slice(0, 500)) {
      const roles = await get<Role[]>(`/users/${u.id}/roles`).catch(() => [] as Role[]);
      if (roles.some((r) => r.type === 'SUPER_ADMIN')) admins.push(nameOf(u));
    }
    results.push(adminsCheck('okta.admins_limited', subject, admins, 'super administrators'));

    results.push(staleCheck('okta.stale_accounts', subject, users.map((u) => ({ name: nameOf(u), lastActive: u.lastLogin, created: u.created })), ctx.now));
    return { results, label: subject };
  },

  async accounts(c) {
    const { base, token } = setup(c);
    const users = await pages<OktaUser>(`${base}/users?limit=200`, token);
    return users.filter((u) => u.status !== 'DEPROVISIONED').map((u): Account => ({
      system: 'Okta', account: u.profile.email ?? u.profile.login, displayName: nameOf(u), privilege: null,
      lastActiveAt: u.lastLogin, enabled: u.status === 'ACTIVE' || u.status === 'PASSWORD_EXPIRED' || u.status === 'LOCKED_OUT' || u.status === 'RECOVERY',
    }));
  },
};
