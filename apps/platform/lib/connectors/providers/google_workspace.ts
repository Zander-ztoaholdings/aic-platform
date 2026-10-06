/**
 * Google Workspace, read with a service account using domain-wide delegation as a super admin (directory user read-only scope).
 * Docs: https://developers.google.com/workspace/admin/directory/reference/rest/v1/users/list
 */
import { call, need, result, adminsCheck, staleCheck, listSome, plural, googleToken } from '../http';
import type { ConnectorImpl, Credentials } from '../types';
import type { CheckResult } from '../../integrations/catalog';
import type { Account } from '../../registers/accounts';

type GUser = {
  primaryEmail: string; name?: { fullName?: string }; isAdmin?: boolean; isDelegatedAdmin?: boolean;
  isEnrolledIn2Sv?: boolean; isEnforcedIn2Sv?: boolean; suspended?: boolean; archived?: boolean;
  lastLoginTime?: string; creationTime?: string;
};

async function listUsers(c: Credentials): Promise<{ users: GUser[]; domain: string }> {
  const sa = need(c, 'serviceAccount', 'The service account key');
  const admin = need(c, 'adminEmail', 'The super admin email');
  const { token } = await googleToken(sa, ['https://www.googleapis.com/auth/admin.directory.user.readonly'], admin);
  const users: GUser[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < 40; i++) {
    const qs = new URLSearchParams({ customer: 'my_customer', projection: 'basic', maxResults: '500', ...(pageToken ? { pageToken } : {}) });
    const page = await call<{ users?: GUser[]; nextPageToken?: string }>(`https://admin.googleapis.com/admin/directory/v1/users?${qs}`, { headers: { Authorization: `Bearer ${token}` } });
    users.push(...(page.users ?? []));
    pageToken = page.nextPageToken;
    if (!pageToken) break;
  }
  return { users, domain: admin.split('@')[1]?.toLowerCase() ?? admin };
}

const active = (u: GUser) => !u.suspended && !u.archived;
/** Google reports "never signed in" as the Unix epoch. */
const lastLogin = (u: GUser) => (u.lastLoginTime && !u.lastLoginTime.startsWith('1970-') ? u.lastLoginTime : null);

function mfaCheck(subject: string, users: GUser[]): CheckResult {
  const key = 'google_workspace.mfa_enforced';
  if (!users.length) return result(key, subject, 'unknown', 'AIC could not read any active users.');
  if (users.every((u) => u.isEnrolledIn2Sv === undefined)) return result(key, subject, 'unknown', 'Google did not say who has 2-Step Verification.');
  const without = users.filter((u) => u.isEnrolledIn2Sv === false).map((u) => u.primaryEmail);
  return without.length
    ? result(key, subject, 'fail', `${plural(without.length, 'active user')} without 2-Step Verification: ${listSome(without)}.`, { users: without })
    : result(key, subject, 'pass', `All ${plural(users.length, 'active user')} have 2-Step Verification.`);
}

export const googleWorkspace: ConnectorImpl = {
  async run(c, ctx) {
    const { users, domain } = await listUsers(c);
    const live = users.filter(active);
    const results: CheckResult[] = [
      mfaCheck(domain, live),
      adminsCheck('google_workspace.admins_limited', domain, live.filter((u) => u.isAdmin).map((u) => u.primaryEmail), 'super admins'),
      staleCheck('google_workspace.stale_accounts', domain, live.map((u) => ({ name: u.primaryEmail, lastActive: lastLogin(u), created: u.creationTime ?? null })), ctx.now),
    ];
    return { results, label: domain };
  },

  async accounts(c) {
    const { users } = await listUsers(c);
    return users.map((u): Account => ({
      system: 'Google Workspace', account: u.primaryEmail, displayName: u.name?.fullName ?? null,
      privilege: u.isAdmin ? 'Super admin' : u.isDelegatedAdmin ? 'Delegated admin' : 'Member',
      lastActiveAt: lastLogin(u), enabled: active(u),
    }));
  },
};
