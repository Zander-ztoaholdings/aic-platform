/**
 * Who has an account where, from the systems an organisation connected.
 *
 * Used twice: an access review lists every account for a person to keep or
 * remove, and the leavers check looks for anyone who has left but still has
 * an enabled account. Read-only, and fetched when needed rather than stored,
 * so a review always starts from what is true today.
 */
import { getTenantDb, integrations, eq } from '@aic/db';
import { collectTenantFacts } from '../integrations/microsoft';
import { installationToken, getInstallation, paginate } from '../integrations/github';
import { connectorAccounts } from '../connectors/registry';

export type Account = {
  system: string;
  account: string;
  displayName: string | null;
  privilege: string | null;
  lastActiveAt: string | null;
  enabled: boolean;
};

const SYSTEM_LABEL: Record<string, string> = { microsoft: 'Microsoft 365', github: 'GitHub' };

export async function listAccounts(orgId: string): Promise<{ accounts: Account[]; notes: string[] }> {
  const rows = await getTenantDb(orgId).query((tx) => tx.select().from(integrations).where(eq(integrations.orgId, orgId)));
  const accounts: Account[] = [];
  const notes: string[] = [];

  for (const i of rows) {
    const label = SYSTEM_LABEL[i.provider] ?? i.accountLabel ?? i.provider;
    try {
      if (i.mode === 'demo') {
        const fixture = ((i.settings ?? {}) as { accounts?: Account[] }).accounts ?? [];
        accounts.push(...fixture);
        continue;
      }
      if (i.provider === 'microsoft' && i.externalId) {
        const f = await collectTenantFacts(i.externalId);
        const admins = new Set((f.globalAdmins ?? []).map((a) => (a.userPrincipalName ?? '').toLowerCase()));
        for (const u of f.users ?? []) {
          if (u.userType && u.userType.toLowerCase() === 'guest') continue;
          const last = u.signInActivity?.lastSignInDateTime ?? u.signInActivity?.lastNonInteractiveSignInDateTime ?? null;
          accounts.push({
            system: label, account: u.userPrincipalName, displayName: u.displayName ?? null,
            privilege: admins.has(u.userPrincipalName.toLowerCase()) ? 'Global administrator' : 'Member',
            lastActiveAt: last, enabled: u.accountEnabled !== false,
          });
        }
        if (!f.users) notes.push('Microsoft 365 did not return a user list; check AIC still has its read permission.');
        continue;
      }
      if (i.provider === 'github' && i.externalId) {
        const token = await installationToken(i.externalId);
        const inst = await getInstallation(i.externalId);
        const login = inst.account?.login;
        if (!login) throw new Error('the GitHub installation has no account');
        const pick = (b: unknown) => (Array.isArray(b) ? (b as { login: string }[]) : []);
        const admins = new Set((await paginate(`/orgs/${login}/members?role=admin&per_page=100`, token, pick)).map((m) => m.login));
        const all = await paginate(`/orgs/${login}/members?per_page=100`, token, pick, 10);
        for (const m of all) accounts.push({ system: 'GitHub', account: m.login, displayName: null, privilege: admins.has(m.login) ? 'Owner' : 'Member', lastActiveAt: null, enabled: true });
        continue;
      }
      const extra = await connectorAccounts(i);
      if (extra) accounts.push(...extra);
    } catch (e) {
      notes.push(`${label}: the account list could not be read (${(e as Error).message.slice(0, 120)}).`);
    }
  }
  return { accounts, notes };
}

/** An account's owner, as best as can be matched to a person: by email, or by the part before the @. */
export function matchesPerson(a: Account, p: { email: string | null; name: string }): boolean {
  const acc = a.account.toLowerCase();
  const email = (p.email ?? '').toLowerCase();
  if (email && (acc === email || acc.split('@')[0] === email.split('@')[0])) return true;
  if (a.displayName && a.displayName.trim().toLowerCase() === p.name.trim().toLowerCase()) return true;
  return false;
}

/** People who have left but still have an enabled account somewhere. */
export function leaversWithAccess(
  people: { name: string; email: string | null; endDate: string | null }[],
  accounts: Account[],
  today = new Date().toISOString().slice(0, 10),
): { name: string; endDate: string; accounts: Account[] }[] {
  return people
    .filter((p) => p.endDate && p.endDate < today)
    .map((p) => ({ name: p.name, endDate: p.endDate!, accounts: accounts.filter((a) => a.enabled && matchesPerson(a, p)) }))
    .filter((x) => x.accounts.length > 0);
}
