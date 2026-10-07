/**
 * Google Workspace, read with a service account using domain-wide delegation as a super admin (directory user read-only scope).
 * Docs: https://developers.google.com/workspace/admin/directory/reference/rest/v1/users/list
 */
import { call, need, result, adminsCheck, staleCheck, listSome, plural, googleToken } from '../http';
import type { ConnectorImpl, Credentials } from '../types';
import type { CheckResult } from '../../integrations/catalog';
import type { Account } from '../../registers/accounts';
import { ConnectorError } from '../types';
import type { AiUseOutput, AiUseRecord } from '../../ai-use/products';

const REPORTS_SCOPE = 'https://www.googleapis.com/auth/admin.reports.audit.readonly';

type GActivity = {
  id?: { time?: string };
  actor?: { email?: string };
  events?: { name?: string; parameters?: { name?: string; value?: string; multiValue?: string[] }[] }[];
};

/**
 * Gemini in Workspace: the Reports API's gemini_in_workspace_apps log, one
 * row per person per day, counting actions and naming the apps. Needs the
 * reports scope added to the same domain-wide delegation. Logs begin on
 * 20 June 2025 and reach back 180 days.
 * Docs: https://developers.google.com/workspace/admin/reports/v1/appendix/activity/gemini-in-workspace-apps
 */
export function mapGemini(items: GActivity[]): AiUseRecord[] {
  const byDay = new Map<string, AiUseRecord & { apps: Set<string> }>();
  for (const a of items) {
    const email = a.actor?.email?.toLowerCase();
    const time = a.id?.time;
    if (!email || !time) continue;
    const day = time.slice(0, 10);
    const k = `${email}|${day}`;
    const rec = byDay.get(k) ?? { product: 'gemini_workspace' as const, subjectType: 'person' as const, subject: email, day, lastActiveAt: time, activity: 0, apps: new Set<string>() };
    for (const e of a.events ?? []) {
      // Category "inactive" is logged when Gemini is opened and nothing is asked of it.
      const params = e.parameters ?? [];
      const category = params.find((p) => /categor/i.test(p.name ?? ''))?.value ?? '';
      if (/^inactive$/i.test(category)) continue;
      rec.activity += 1;
      const app = params.find((p) => /app/i.test(p.name ?? ''))?.value;
      if (app) rec.apps.add(app);
    }
    if (time > (rec.lastActiveAt ?? '')) rec.lastActiveAt = time;
    byDay.set(k, rec);
  }
  return [...byDay.values()].filter((r) => r.activity > 0).map(({ apps, ...r }) => ({ ...r, metrics: { apps: [...apps].sort().join(', ') || null } }));
}

async function geminiUse(c: Credentials, days: number, now: Date): Promise<AiUseOutput> {
  const sa = need(c, 'serviceAccount', 'The service account key');
  const admin = need(c, 'adminEmail', 'The super admin email');
  let token: string;
  try {
    ({ token } = await googleToken(sa, [REPORTS_SCOPE], admin));
  } catch (e) {
    if (e instanceof ConnectorError && (e.status === 400 || e.status === 401 || e.status === 403)) {
      return { records: [], notes: [`Gemini in Google Workspace: add the scope ${REPORTS_SCOPE} to AIC's service account under Security → Access and data control → API controls → Domain-wide delegation.`] };
    }
    throw e;
  }
  const items: GActivity[] = [];
  let pageToken: string | undefined;
  const startTime = new Date(now.getTime() - days * 86_400_000).toISOString();
  try {
    for (let i = 0; i < 40; i++) {
      const qs = new URLSearchParams({ startTime, maxResults: '1000', ...(pageToken ? { pageToken } : {}) });
      const page = await call<{ items?: GActivity[]; nextPageToken?: string }>(`https://admin.googleapis.com/admin/reports/v1/activity/users/all/applications/gemini_in_workspace_apps?${qs}`, { headers: { Authorization: `Bearer ${token}` } });
      items.push(...(page.items ?? []));
      pageToken = page.nextPageToken;
      if (!pageToken) break;
    }
  } catch (e) {
    if (e instanceof ConnectorError && (e.status === 400 || e.status === 403 || e.status === 404)) {
      return { records: [], notes: [`Gemini in Google Workspace: Google would not return the Gemini activity log (${e.status}). It needs a super admin to read as, and a Workspace edition that logs Gemini use.`] };
    }
    throw e;
  }
  return { records: mapGemini(items), notes: [] };
}

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

  async aiUse(c, ctx, days) {
    return geminiUse(c, days, ctx.now);
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
