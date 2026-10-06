/**
 * Datadog, read with an API key and an application key owned by a service account with the Datadog Read Only Role.
 * Docs: docs.datadoghq.com/api/latest/users/
 */
import { call, need, result, adminsCheck, listSome, plural, daysSince } from '../http';
import type { ConnectorImpl, Credentials } from '../types';
import type { CheckResult } from '../../integrations/catalog';
import type { Account } from '../../registers/accounts';

type User = {
  id: string;
  attributes: { email?: string; handle?: string; name?: string | null; status?: string; disabled?: boolean; created_at?: string };
  relationships?: { roles?: { data?: { id: string }[] } };
};
type Role = { id: string; attributes?: { name?: string } };

const ADMIN_ROLE = 'Datadog Admin Role';

function client(c: Credentials) {
  const site = (c.site ?? '').trim().replace(/^https?:\/\//, '').replace(/^api\./, '').replace(/\/+$/, '') || 'datadoghq.com';
  const base = `https://api.${site}`;
  const headers = { 'DD-API-KEY': need(c, 'apiKey', 'The API key'), 'DD-APPLICATION-KEY': need(c, 'appKey', 'The application key') };
  const get = <T>(path: string) => call<T>(`${base}${path}`, { headers });
  async function users(): Promise<User[]> {
    const out: User[] = [];
    for (let page = 0; page < 20; page++) {
      const j = await get<{ data?: User[]; meta?: { page?: { total_count?: number } } }>(`/api/v2/users?page[size]=100&page[number]=${page}`);
      const rows = j.data ?? [];
      out.push(...rows);
      if (rows.length < 100 || (j.meta?.page?.total_count !== undefined && out.length >= j.meta.page.total_count)) break;
    }
    return out;
  }
  async function adminRoleId(): Promise<string | null> {
    const roles = (await get<{ data?: Role[] }>('/api/v2/roles?page[size]=100')).data ?? [];
    return roles.find((r) => r.attributes?.name === ADMIN_ROLE)?.id ?? null;
  }
  return { site, get, users, adminRoleId };
}

const emailOf = (u: User) => u.attributes.email || u.attributes.handle || u.id;
const isActive = (u: User) => u.attributes.status === 'Active' && !u.attributes.disabled;
const hasRole = (u: User, id: string | null) => !!id && (u.relationships?.roles?.data ?? []).some((r) => r.id === id);
const status = (e: unknown) => (e as { status?: number }).status;

export const datadog: ConnectorImpl = {
  async run(c, ctx) {
    const { site, get, users: listUsers, adminRoleId } = client(c);
    const subject = site;
    const users = await listUsers();
    const results: CheckResult[] = [];

    // Admins: active users holding the Datadog Admin Role.
    try {
      const id = await adminRoleId();
      if (!id) results.push(result('datadog.admins_limited', subject, 'unknown', `AIC could not find the ${ADMIN_ROLE}.`));
      else results.push(adminsCheck('datadog.admins_limited', subject, users.filter((u) => isActive(u) && hasRole(u, id)).map(emailOf), 'administrators'));
    } catch (e) {
      if (status(e) === 401) throw e;
      results.push(result('datadog.admins_limited', subject, 'unknown', `Could not read roles: ${(e as Error).message}`));
    }

    // Invitations nobody accepted within 30 days.
    const stale = users.filter((u) => u.attributes.status === 'Pending' && (daysSince(u.attributes.created_at ?? null, ctx.now) ?? 0) > 30).map(emailOf);
    results.push(stale.length
      ? result('datadog.stale_invites', subject, 'fail', `${plural(stale.length, 'invitation')} waiting for over 30 days: ${listSome(stale)}.`, { invites: stale })
      : result('datadog.stale_invites', subject, 'pass', 'No invitations have been waiting for over 30 days.'));

    // Audit Trail: any event in the last day shows it is collecting.
    try {
      const j = await get<{ data?: unknown[] }>('/api/v2/audit/events?filter[from]=now-1d&page[limit]=1');
      results.push((j.data ?? []).length
        ? result('datadog.audit_trail_enabled', subject, 'pass', 'Audit Trail recorded events in the last day.')
        : result('datadog.audit_trail_enabled', subject, 'warn', 'Audit Trail recorded no events in the last day. It may be switched off.'));
    } catch (e) {
      if (status(e) === 403 || status(e) === 404) results.push(result('datadog.audit_trail_enabled', subject, 'unknown', 'AIC could not read Audit Trail. It is a paid feature, or the key lacks permission to read audit logs.'));
      else if (status(e) === 401) throw e;
      else results.push(result('datadog.audit_trail_enabled', subject, 'unknown', `Could not read Audit Trail: ${(e as Error).message}`));
    }

    return { results, label: `Datadog (${site})` };
  },

  async accounts(c) {
    const { users: listUsers, adminRoleId } = client(c);
    const users = await listUsers();
    const id = await adminRoleId().catch(() => null);
    return users.map((u): Account => ({
      system: 'Datadog', account: emailOf(u), displayName: u.attributes.name || null,
      privilege: hasRole(u, id) ? 'Admin' : 'Member', lastActiveAt: null, enabled: isActive(u),
    }));
  },
};
