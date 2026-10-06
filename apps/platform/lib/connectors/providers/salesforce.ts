/**
 * Salesforce, read through a connected app using the OAuth client credentials flow with a read-only run-as user.
 * Docs: developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_query.htm
 */
import { call, baseUrl, need, result, adminsCheck, staleCheck, clientCredentials } from '../http';
import type { ConnectorImpl, Credentials } from '../types';
import type { CheckResult } from '../../integrations/catalog';
import type { Account } from '../../registers/accounts';

const VERSION = 'v61.0';
type QueryPage<T> = { records?: T[]; done?: boolean; nextRecordsUrl?: string };
type Assignment = { AssigneeId: string; Assignee?: { Name?: string; Username?: string } | null };
type User = { Id: string; Name?: string; Username?: string; Email?: string | null; IsActive?: boolean; LastLoginDate?: string | null; CreatedDate?: string | null; Profile?: { Name?: string } | null };

async function client(c: Credentials) {
  const base = baseUrl(need(c, 'domain', 'The My Domain address'));
  const token = await clientCredentials(`${base}/services/oauth2/token`, need(c, 'clientId', 'The consumer key'), need(c, 'clientSecret', 'The consumer secret'));
  async function query<T>(soql: string): Promise<T[]> {
    const out: T[] = [];
    let next: string | null = `/services/data/${VERSION}/query?q=${encodeURIComponent(soql)}`;
    for (let i = 0; next && i < 20; i++) {
      const j: QueryPage<T> = await call<QueryPage<T>>(`${base}${next}`, { headers: { Authorization: `Bearer ${token}` } });
      out.push(...(j.records ?? []));
      next = !j.done && j.nextRecordsUrl ? j.nextRecordsUrl : null;
    }
    return out;
  }
  return { host: new URL(base).host, query };
}

const status = (e: unknown) => (e as { status?: number }).status;

export const salesforce: ConnectorImpl = {
  async run(c, ctx) {
    const { host, query } = await client(c);
    const subject = host;
    const results: CheckResult[] = [];

    // Stale accounts first: a broken connection fails here and shows as broken.
    const users = await query<User>("SELECT Id, Name, Username, Email, LastLoginDate, CreatedDate FROM User WHERE IsActive = true AND UserType = 'Standard'");

    // People who can modify all data, through a profile or a permission set.
    try {
      const rows = await query<Assignment>('SELECT AssigneeId, Assignee.Name, Assignee.Username FROM PermissionSetAssignment WHERE PermissionSet.PermissionsModifyAllData = true AND Assignee.IsActive = true');
      const seen = new Map<string, string>();
      for (const r of rows) if (!seen.has(r.AssigneeId)) seen.set(r.AssigneeId, r.Assignee?.Name || r.Assignee?.Username || r.AssigneeId);
      results.push(adminsCheck('salesforce.admins_limited', subject, [...seen.values()], ['person who can modify all data', 'people who can modify all data']));
    } catch (e) {
      if (status(e) === 401) throw e;
      results.push(result('salesforce.admins_limited', subject, 'unknown', `Could not read permission sets: ${(e as Error).message}`));
    }

    results.push(staleCheck('salesforce.stale_accounts', subject, users.map((u) => ({ name: u.Name || u.Username || u.Id, lastActive: u.LastLoginDate ?? null, created: u.CreatedDate ?? null })), ctx.now));
    return { results, label: host };
  },

  async accounts(c) {
    const { query } = await client(c);
    const users = await query<User>("SELECT Id, Name, Username, Email, IsActive, LastLoginDate, Profile.Name FROM User WHERE UserType = 'Standard'");
    return users.map((u): Account => ({
      system: 'Salesforce', account: u.Email || u.Username || u.Id, displayName: u.Name ?? null,
      privilege: u.Profile?.Name ?? null, lastActiveAt: u.LastLoginDate ?? null, enabled: u.IsActive === true,
    }));
  },
};
