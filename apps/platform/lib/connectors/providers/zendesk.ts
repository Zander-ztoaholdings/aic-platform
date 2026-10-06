/**
 * Zendesk Support, read with an admin's API token (Basic auth, `{email}/token` and the token).
 * Docs: https://developer.zendesk.com/api-reference/ticketing/users/users/
 */
import { call, basic, need, result, adminsCheck, staleCheck, listSome, plural } from '../http';
import { ConnectorError, type ConnectorImpl, type Credentials } from '../types';
import type { CheckResult } from '../../integrations/catalog';
import type { Account } from '../../registers/accounts';

type ZdUser = {
  id: number; name?: string; email?: string; role: string; active?: boolean; suspended?: boolean;
  two_factor_auth_enabled?: boolean | null; last_login_at?: string | null; created_at?: string;
};
type Page = { users?: ZdUser[]; meta?: { has_more?: boolean }; links?: { next?: string | null } };

function setup(c: Credentials) {
  const sub = need(c, 'subdomain', 'The Zendesk subdomain').replace(/^https?:\/\//i, '').replace(/\.zendesk\.com.*$/i, '').replace(/\/.*$/, '');
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(sub)) throw new ConnectorError(400, 'The Zendesk subdomain should be just the part before .zendesk.com.');
  return { host: `${sub.toLowerCase()}.zendesk.com`, auth: basic(`${need(c, 'email', 'The admin email')}/token`, need(c, 'token', 'The API token')) };
}

/** Agents and admins, following cursor pagination up to 20 pages. */
async function staff(host: string, auth: string): Promise<ZdUser[]> {
  const out: ZdUser[] = [];
  let next: string | null | undefined = `https://${host}/api/v2/users?role[]=admin&role[]=agent&page[size]=100`;
  for (let i = 0; next && i < 20; i++) {
    const p: Page = await call<Page>(next, { headers: { Authorization: auth } });
    out.push(...(p.users ?? []));
    next = p.meta?.has_more ? p.links?.next : null;
  }
  return out;
}

const nameOf = (u: ZdUser) => u.name || u.email || String(u.id);
const live = (u: ZdUser) => u.active !== false && !u.suspended;

export const zendesk: ConnectorImpl = {
  async run(c, ctx) {
    const { host, auth } = setup(c);
    // First and only call: a bad token or email stops the run here.
    const users = (await staff(host, auth)).filter((u) => u.role === 'admin' || u.role === 'agent');
    const current = users.filter(live);
    const results: CheckResult[] = [];

    // Unverified: two_factor_auth_enabled is documented as read-only and may be hidden for SSO sign-in; absent everywhere means AIC cannot tell.
    const known = current.filter((u) => typeof u.two_factor_auth_enabled === 'boolean');
    const without = known.filter((u) => u.two_factor_auth_enabled === false).map(nameOf);
    if (!current.length) results.push(result('zendesk.agents_mfa', host, 'unknown', 'AIC could not see any active agents or admins.'));
    else if (!known.length) results.push(result('zendesk.agents_mfa', host, 'unknown', 'Zendesk did not say who has two-factor sign-in. If your team signs in through single sign-on, two-factor is probably handled by your sign-in provider.'));
    else if (without.length) results.push(result('zendesk.agents_mfa', host, 'fail', `${plural(without.length, 'agent or admin', 'agents or admins')} without two-factor sign-in: ${listSome(without)}.`, { users: without }));
    else results.push(result('zendesk.agents_mfa', host, 'pass', `All ${plural(known.length, 'active agent or admin', 'active agents and admins')} have two-factor sign-in.`));

    results.push(adminsCheck('zendesk.admins_limited', host, current.filter((u) => u.role === 'admin').map(nameOf), 'admins'));
    results.push(staleCheck('zendesk.stale_agents', host, current.map((u) => ({ name: nameOf(u), lastActive: u.last_login_at ?? null, created: u.created_at ?? null })), ctx.now));

    return { results, label: host };
  },

  async accounts(c) {
    const { host, auth } = setup(c);
    const users = await staff(host, auth);
    return users.map((u): Account => ({
      system: 'Zendesk', account: u.email || nameOf(u), displayName: u.name ?? null,
      privilege: u.role === 'admin' ? 'Admin' : u.role === 'agent' ? 'Agent' : u.role || null,
      lastActiveAt: u.last_login_at ?? null, enabled: live(u),
    }));
  },
};
