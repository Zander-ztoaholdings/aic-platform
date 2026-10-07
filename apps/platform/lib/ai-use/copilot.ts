/**
 * Copilot, from the two places it lives.
 *
 * GitHub Copilot: the organisation's seat list, through the AIC GitHub App.
 * Each seat names the person, when they last used Copilot and in which
 * editor. Needs the App's organisation permission "GitHub Copilot Business"
 * (read); an installation that has not accepted it gets a note, not an error.
 * Docs: https://docs.github.com/en/rest/copilot/copilot-user-management
 *
 * Microsoft 365 Copilot: the Copilot usage report through Graph, with the
 * application permission Reports.Read.All. Each row is a licensed person and
 * the last day they used Copilot in each app. If the tenant hides names in
 * reports, Graph returns hashes instead of addresses; AIC says so.
 * Docs: https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/api/admin-settings/reports/copilotreportroot-getmicrosoft365copilotusageuserdetail
 */
import { paginate, GitHubError } from '../integrations/github';
import { tenantToken, graphList } from '../integrations/microsoft';
import { isoDay, type AiUseOutput, type AiUseRecord } from './products';

// ── GitHub Copilot ──────────────────────────────────────────────────────────

type Seat = {
  assignee?: { login?: string; type?: string } | null;
  last_activity_at?: string | null;
  last_activity_editor?: string | null;
  plan_type?: string | null;
  pending_cancellation_date?: string | null;
  created_at?: string | null;
};

export function mapCopilotSeats(seats: Seat[], now = new Date()): AiUseRecord[] {
  const day = isoDay(now);
  return seats
    .filter((s) => s.assignee?.login)
    .map((s) => ({
      product: 'github_copilot' as const,
      subjectType: 'person' as const,
      subject: s.assignee!.login!,
      day,
      lastActiveAt: s.last_activity_at ?? null,
      activity: 0,
      metrics: {
        // "vscode/1.77.3/copilot/1.86.82" → "vscode"
        editor: s.last_activity_editor ? s.last_activity_editor.split('/')[0] : null,
        plan: s.plan_type ?? null,
        assignedAt: s.created_at ?? null,
        cancelling: !!s.pending_cancellation_date,
      },
    }));
}

export async function pullGithubCopilot(org: string, token: string, now = new Date()): Promise<AiUseOutput> {
  try {
    const seats = await paginate<Seat>(`/orgs/${encodeURIComponent(org)}/copilot/billing/seats?per_page=100`, token, (b) => (b as { seats?: Seat[] }).seats ?? [], 20);
    return { records: mapCopilotSeats(seats, now), notes: [], facts: { seats: seats.length } };
  } catch (e) {
    if (e instanceof GitHubError && (e.status === 403 || e.status === 404)) {
      return {
        records: [],
        notes: [e.status === 404
          ? 'GitHub Copilot: this organisation has no Copilot Business or Enterprise subscription, or AIC cannot see it.'
          : 'GitHub Copilot: the AIC app has not been granted "GitHub Copilot Business" (read). An organisation owner can accept the new permission under Settings → GitHub Apps → AIC.'],
      };
    }
    throw e;
  }
}

// ── Microsoft 365 Copilot ───────────────────────────────────────────────────

type M365Row = {
  reportRefreshDate?: string;
  userPrincipalName?: string;
  displayName?: string;
  lastActivityDate?: string | null;
  [app: string]: string | null | undefined;
};

const APPS: [string, string][] = [
  ['copilotChatLastActivityDate', 'Copilot Chat'],
  ['microsoftTeamsCopilotLastActivityDate', 'Teams'],
  ['wordCopilotLastActivityDate', 'Word'],
  ['excelCopilotLastActivityDate', 'Excel'],
  ['powerPointCopilotLastActivityDate', 'PowerPoint'],
  ['outlookCopilotLastActivityDate', 'Outlook'],
  ['oneNoteCopilotLastActivityDate', 'OneNote'],
  ['loopCopilotLastActivityDate', 'Loop'],
];

/** Hidden names come back as 32-character hex hashes rather than addresses. */
export const looksConcealed = (upn: string) => /^[0-9A-F]{32}$/i.test(upn);

export function mapM365Copilot(rows: M365Row[], now = new Date()): { records: AiUseRecord[]; concealed: boolean } {
  let concealed = false;
  const records: AiUseRecord[] = [];
  for (const r of rows) {
    const upn = r.userPrincipalName?.trim();
    if (!upn) continue;
    if (looksConcealed(upn)) concealed = true;
    const used = APPS.filter(([k]) => r[k]).map(([, label]) => label);
    records.push({
      product: 'm365_copilot', subjectType: 'person', subject: upn.toLowerCase(), displayName: r.displayName ?? null,
      day: (r.reportRefreshDate || isoDay(now)).slice(0, 10),
      lastActiveAt: r.lastActivityDate ? `${r.lastActivityDate}T00:00:00Z` : null,
      activity: 0,
      metrics: { apps: used.join(', ') || null },
    });
  }
  return { records, concealed };
}

export async function pullM365Copilot(tenantId: string, now = new Date()): Promise<AiUseOutput> {
  const token = await tenantToken(tenantId);
  const rows = await graphList<M365Row>("/v1.0/copilot/reports/getMicrosoft365CopilotUsageUserDetail(period='D30')?$format=application/json", token);
  if (rows === null) {
    return { records: [], notes: ['Microsoft 365 Copilot: AIC cannot read the Copilot usage report. Grant the AIC app the Reports.Read.All application permission, then reconnect Microsoft 365.'] };
  }
  const { records, concealed } = mapM365Copilot(rows, now);
  const notes = concealed
    ? ['Microsoft 365 Copilot: your tenant hides names in usage reports, so people appear as codes. To see names, a global administrator can turn off "Display concealed user, group, and site names in all reports" in the Microsoft 365 admin centre under Settings → Org settings → Reports.']
    : [];
  return { records, notes, facts: { licensedUsers: rows.length } };
}
