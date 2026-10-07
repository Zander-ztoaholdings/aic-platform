/**
 * Microsoft Azure, read through the Microsoft 365 connection: an app-only Azure Resource Manager token for the tenant, with Reader and Security Reader on each subscription.
 * Docs: https://learn.microsoft.com/en-us/rest/api/authorization/role-assignments/list-for-subscription
 */
import { call, result, listSome, plural } from '../http';
import { ConnectorError, type ConnectorImpl, type Credentials, type RunContext } from '../types';
import type { CheckResult } from '../../integrations/catalog';
import { tenantToken, MicrosoftError } from '@/lib/integrations/microsoft';
import type { AiUseOutput, AiUseRecord } from '../../ai-use/products';

const ARM = 'https://management.azure.com';
const OWNER = '8e3af657-a8ff-443c-a75c-2fe8c4bcb635';
const SUBJECT = 'Azure';

type Sub = { id: string; name: string };
type Page<T> = { value?: T[]; nextLink?: string };
type RoleAssignment = { properties: { roleDefinitionId: string; principalId: string; principalType?: string } };
type StorageAccount = { name: string; properties?: { allowBlobPublicAccess?: boolean; supportsHttpsTrafficOnly?: boolean; minimumTlsVersion?: string } };
type DiagSetting = { name: string; properties?: { workspaceId?: string | null; storageAccountId?: string | null; eventHubAuthorizationRuleId?: string | null; logs?: { category?: string | null; categoryGroup?: string | null; enabled: boolean }[] } };
type Assessment = { name: string; properties?: { displayName?: string; status?: { code?: string }; metadata?: { severity?: string }; resourceDetails?: { Id?: string; id?: string } } };
type AssessmentMeta = { name: string; properties?: { severity?: string } };

export async function microsoftToken(ctx: RunContext, scope?: string, what = 'Azure'): Promise<string> {
  if (!ctx.microsoftTenant) throw new ConnectorError(400, `Connect Microsoft 365 first, then connect ${what}.`);
  try {
    return await tenantToken(ctx.microsoftTenant, scope);
  } catch (e) {
    if (e instanceof MicrosoftError) throw new ConnectorError(e.status, e.message);
    throw e;
  }
}

async function list<T>(url: string, token: string, max = 20): Promise<T[]> {
  const out: T[] = [];
  let next: string | undefined = url;
  for (let i = 0; next && i < max; i++) {
    const page: Page<T> = await call<Page<T>>(next, { headers: { Authorization: `Bearer ${token}` } });
    out.push(...(page.value ?? []));
    next = page.nextLink;
  }
  return out;
}

async function subscriptions(c: Credentials, token: string): Promise<Sub[]> {
  const given = (c.subscriptions ?? '').split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
  if (given.length) {
    return Promise.all(given.map(async (id) => {
      const s = await call<{ displayName?: string }>(`${ARM}/subscriptions/${encodeURIComponent(id)}?api-version=2022-12-01`, { headers: { Authorization: `Bearer ${token}` } })
        .catch((e) => { if (e instanceof ConnectorError && e.status === 401) throw e; return {} as { displayName?: string }; });
      return { id, name: s.displayName || id };
    }));
  }
  const all = await list<{ subscriptionId: string; displayName?: string; state?: string }>(`${ARM}/subscriptions?api-version=2022-12-01`, token);
  const subs = all.filter((s) => !s.state || s.state === 'Enabled').map((s) => ({ id: s.subscriptionId, name: s.displayName || s.subscriptionId }));
  if (!subs.length) throw new ConnectorError(403, 'AIC cannot see any Azure subscriptions. Assign Reader and Security Reader to the AIC Platform app on each subscription.');
  return subs;
}

/** Runs one check across subscriptions; a subscription that refuses is noted rather than failing the check. */
async function perSub<T>(subs: Sub[], read: (s: Sub) => Promise<T>): Promise<{ ok: { sub: Sub; data: T }[]; failed: { sub: Sub; error: string }[] }> {
  const ok: { sub: Sub; data: T }[] = [];
  const failed: { sub: Sub; error: string }[] = [];
  for (const s of subs) {
    try { ok.push({ sub: s, data: await read(s) }); } catch (e) {
      if (e instanceof ConnectorError && e.status === 401) throw e;
      failed.push({ sub: s, error: (e as Error).message });
    }
  }
  return { ok, failed };
}

const unreadNote = (failed: { sub: Sub }[]) => (failed.length ? ` AIC could not read ${listSome(failed.map((f) => f.sub.name))}.` : '');
const allUnread = (key: string, what: string, failed: { sub: Sub; error: string }[]) => result(key, SUBJECT, 'unknown', `Could not read ${what} in any subscription: ${failed[0]?.error ?? 'no subscriptions'}`);

async function ownersCheck(subs: Sub[], token: string): Promise<CheckResult> {
  const key = 'azure.owners_limited';
  const { ok, failed } = await perSub(subs, (s) => list<RoleAssignment>(`${ARM}/subscriptions/${s.id}/providers/Microsoft.Authorization/roleAssignments?api-version=2022-04-01&$filter=${encodeURIComponent('atScope()')}`, token));
  if (!ok.length) return allUnread(key, 'role assignments', failed);
  const counts = ok.map(({ sub, data }) => ({
    sub: sub.name,
    // Principal ids only; names would need a Graph lookup.
    owners: [...new Set(data.filter((a) => a.properties.roleDefinitionId?.toLowerCase().endsWith(OWNER) && a.properties.principalType === 'User').map((a) => a.properties.principalId))],
  }));
  const tooMany = counts.filter((c) => c.owners.length > 3);
  const single = counts.filter((c) => c.owners.length === 1);
  const detail = { owners: Object.fromEntries(counts.map((c) => [c.sub, c.owners])) };
  if (tooMany.length) return result(key, SUBJECT, 'fail', `More than three people hold Owner on ${plural(tooMany.length, 'subscription')}: ${listSome(tooMany.map((c) => `${c.sub} (${c.owners.length})`))}.${unreadNote(failed)}`, detail);
  if (single.length) return result(key, SUBJECT, 'warn', `Only one person holds Owner on ${listSome(single.map((c) => c.sub))}. If that account is lost, nobody can manage it.${unreadNote(failed)}`, detail);
  return result(key, SUBJECT, failed.length ? 'unknown' : 'pass', `Three or fewer people hold Owner on each of ${plural(ok.length, 'subscription')}.${unreadNote(failed)}`, detail);
}

async function storageCheck(subs: Sub[], token: string): Promise<CheckResult> {
  const key = 'azure.storage_no_public_access';
  const { ok, failed } = await perSub(subs, (s) => list<StorageAccount>(`${ARM}/subscriptions/${s.id}/providers/Microsoft.Storage/storageAccounts?api-version=2023-05-01`, token));
  if (!ok.length) return allUnread(key, 'storage accounts', failed);
  const bad: string[] = [];
  let total = 0;
  for (const { sub, data } of ok) {
    for (const a of data) {
      total++;
      const p = a.properties ?? {};
      const why: string[] = [];
      // Unverified: a missing field is treated as fine, though older accounts may default to allowing public blobs and TLS 1.0.
      if (p.allowBlobPublicAccess === true) why.push('public blobs allowed');
      if (p.supportsHttpsTrafficOnly === false) why.push('plain HTTP allowed');
      if (p.minimumTlsVersion === 'TLS1_0' || p.minimumTlsVersion === 'TLS1_1') why.push(`minimum TLS ${p.minimumTlsVersion.slice(3).replace('_', '.')}`);
      if (why.length) bad.push(`${a.name} in ${sub.name} (${why.join(', ')})`);
    }
  }
  if (bad.length) return result(key, SUBJECT, 'fail', `${plural(bad.length, 'storage account')} ${bad.length === 1 ? 'is' : 'are'} too open: ${listSome(bad)}.${unreadNote(failed)}`, { accounts: bad });
  if (!total) return result(key, SUBJECT, failed.length ? 'unknown' : 'pass', `There are no storage accounts.${unreadNote(failed)}`);
  return result(key, SUBJECT, failed.length ? 'unknown' : 'pass', `All ${plural(total, 'storage account')} block public blobs and require TLS 1.2.${unreadNote(failed)}`);
}

async function activityLogCheck(subs: Sub[], token: string): Promise<CheckResult> {
  const key = 'azure.activity_log_exported';
  const { ok, failed } = await perSub(subs, (s) => list<DiagSetting>(`${ARM}/subscriptions/${s.id}/providers/Microsoft.Insights/diagnosticSettings?api-version=2021-05-01-preview`, token));
  if (!ok.length) return allUnread(key, 'activity log settings', failed);
  const exported = (d: DiagSetting) => {
    const p = d.properties ?? {};
    const dest = !!(p.workspaceId || p.storageAccountId || p.eventHubAuthorizationRuleId);
    return dest && (p.logs ?? []).some((l) => l.enabled && (l.categoryGroup === 'allLogs' || l.category === 'Administrative' || l.category === 'Security'));
  };
  const missing = ok.filter(({ data }) => !data.some(exported)).map(({ sub }) => sub.name);
  if (missing.length) return result(key, SUBJECT, 'fail', `The activity log is not exported for ${plural(missing.length, 'subscription')}: ${listSome(missing)}.${unreadNote(failed)}`, { subscriptions: missing });
  return result(key, SUBJECT, failed.length ? 'unknown' : 'pass', `The activity log is exported for ${ok.length === 1 ? ok[0].sub.name : `all ${ok.length} subscriptions`}.${unreadNote(failed)}`);
}

async function defenderCheck(subs: Sub[], token: string): Promise<CheckResult> {
  const key = 'azure.defender_unhealthy_assessments';
  const { ok, failed } = await perSub(subs, (s) => list<Assessment>(`${ARM}/subscriptions/${s.id}/providers/Microsoft.Security/assessments?api-version=2020-01-01`, token, 50));
  if (!ok.length) return allUnread(key, 'Defender for Cloud recommendations', failed);
  const unhealthy = ok.flatMap(({ sub, data }) => data.filter((a) => a.properties?.status?.code === 'Unhealthy').map((a) => ({ sub, a })));
  // Unverified: the list may leave out metadata. If so, severity comes from the assessment metadata catalogue, matched by assessment name.
  let severity = new Map<string, string>();
  if (unhealthy.some(({ a }) => !a.properties?.metadata?.severity)) {
    const meta = await list<AssessmentMeta>(`${ARM}/providers/Microsoft.Security/assessmentMetadata?api-version=2020-01-01`, token, 20).catch(() => [] as AssessmentMeta[]);
    severity = new Map(meta.map((m) => [m.name, m.properties?.severity ?? '']));
  }
  const sev = (a: Assessment) => a.properties?.metadata?.severity ?? severity.get(a.name) ?? null;
  const high = unhealthy.filter(({ a }) => sev(a) === 'High');
  const unrated = unhealthy.filter(({ a }) => sev(a) === null).length;
  if (high.length) {
    const byName = new Map<string, number>();
    for (const { sub, a } of high) { const n = `${a.properties?.displayName ?? a.name} in ${sub.name}`; byName.set(n, (byName.get(n) ?? 0) + 1); }
    const names = [...byName.entries()].map(([n, c]) => (c > 1 ? `${n} (${c} resources)` : n));
    return result(key, SUBJECT, 'fail', `${plural(high.length, 'high-severity recommendation')} open: ${listSome(names)}.${unreadNote(failed)}`, { recommendations: names });
  }
  if (unrated) return result(key, SUBJECT, 'unknown', `AIC could not tell the severity of ${plural(unrated, 'open recommendation')}.${unreadNote(failed)}`);
  return result(key, SUBJECT, failed.length ? 'unknown' : 'pass', `No high-severity recommendations are open${unhealthy.length ? ` (${plural(unhealthy.length, 'lower one')} remain)` : ''}.${unreadNote(failed)}`);
}

// ── Azure OpenAI and AI Foundry ─────────────────────────────────────────────
//
// Cognitive Services accounts of kind OpenAI or AIServices, their model
// deployments, and Azure Monitor's daily request and token totals per
// deployment. Reader on the subscription covers all three. No person is in
// these figures: a row is a deployment on a day.
// Docs: https://learn.microsoft.com/en-us/azure/foundry-classic/openai/monitor-openai-reference

type CsAccount = { id: string; name: string; kind?: string; location?: string };
type Deployment = { name: string; properties?: { model?: { name?: string; version?: string } } };
type MetricsBody = { value?: { name?: { value?: string }; timeseries?: { metadatavalues?: { name?: { value?: string }; value?: string }[]; data?: { timeStamp: string; total?: number }[] }[] }[] };

export function mapAzureMetrics(account: CsAccount, deployments: Deployment[], body: MetricsBody): AiUseRecord[] {
  const model = new Map(deployments.map((d) => [d.name.toLowerCase(), [d.properties?.model?.name, d.properties?.model?.version].filter(Boolean).join(' ')]));
  const rows = new Map<string, AiUseRecord>();
  for (const metric of body.value ?? []) {
    const name = metric.name?.value ?? '';
    for (const ts of metric.timeseries ?? []) {
      const dep = ts.metadatavalues?.find((m) => /deployment/i.test(m.name?.value ?? ''))?.value ?? '(all deployments)';
      for (const p of ts.data ?? []) {
        const total = p.total ?? 0;
        if (!total) continue;
        const day = p.timeStamp.slice(0, 10);
        const key = `${dep}|${day}`;
        const r = rows.get(key) ?? {
          product: 'azure_openai' as const, subjectType: 'model' as const,
          subject: `${account.name}/${dep}`, displayName: model.get(dep.toLowerCase()) || null, day,
          lastActiveAt: `${day}T00:00:00Z`, activity: 0, metrics: { account: account.name, location: account.location ?? null, inputTokens: 0, outputTokens: 0 },
        };
        const m = r.metrics as Record<string, number>;
        if (name === 'AzureOpenAIRequests') r.activity += total;
        else if (name === 'ProcessedPromptTokens') m.inputTokens += total;
        else if (name === 'GeneratedTokens') m.outputTokens += total;
        rows.set(key, r);
      }
    }
  }
  return [...rows.values()].filter((r) => r.activity > 0 || (r.metrics as Record<string, number>).inputTokens > 0);
}

async function azureAiUse(c: Credentials, ctx: RunContext, days: number): Promise<AiUseOutput> {
  const token = await microsoftToken(ctx, 'https://management.azure.com/.default', 'Azure');
  const subs = await subscriptions(c, token);
  const records: AiUseRecord[] = [];
  const notes: string[] = [];
  const end = new Date(Date.UTC(ctx.now.getUTCFullYear(), ctx.now.getUTCMonth(), ctx.now.getUTCDate()));
  const start = new Date(end.getTime() - Math.min(days, 30) * 86_400_000);
  for (const sub of subs) {
    let accounts: CsAccount[];
    try {
      accounts = (await list<CsAccount>(`${ARM}/subscriptions/${encodeURIComponent(sub.id)}/providers/Microsoft.CognitiveServices/accounts?api-version=2024-10-01`, token))
        .filter((a) => /^(OpenAI|AIServices)$/i.test(a.kind ?? ''));
    } catch (e) {
      if (e instanceof ConnectorError && e.status === 401) throw e;
      notes.push(`Azure OpenAI: could not list AI accounts in ${sub.name}.`);
      continue;
    }
    for (const a of accounts.slice(0, 25)) {
      const deployments = await list<Deployment>(`${ARM}${a.id}/deployments?api-version=2024-10-01`, token).catch(() => [] as Deployment[]);
      const qs = new URLSearchParams({
        'api-version': '2018-01-01',
        metricnames: 'AzureOpenAIRequests,ProcessedPromptTokens,GeneratedTokens',
        timespan: `${start.toISOString()}/${end.toISOString()}`,
        interval: 'P1D', aggregation: 'Total', $filter: "ModelDeploymentName eq '*'",
      });
      try {
        const body = await call<MetricsBody>(`${ARM}${a.id}/providers/microsoft.insights/metrics?${qs}`, { headers: { Authorization: `Bearer ${token}` } });
        records.push(...mapAzureMetrics(a, deployments, body));
      } catch (e) {
        if (e instanceof ConnectorError && e.status === 401) throw e;
        notes.push(`Azure OpenAI: could not read usage metrics for ${a.name}.`);
      }
    }
  }
  return { records, notes };
}

export const azure: ConnectorImpl = {
  async run(c, ctx) {
    const token = await microsoftToken(ctx, 'https://management.azure.com/.default', 'Azure');
    const subs = await subscriptions(c, token);
    const results = [
      await ownersCheck(subs, token),
      await storageCheck(subs, token),
      await activityLogCheck(subs, token),
      await defenderCheck(subs, token),
    ];
    return { results, label: subs.length === 1 ? `Azure ${subs[0].name}` : `Azure, ${plural(subs.length, 'subscription')}` };
  },

  aiUse: azureAiUse,
};
