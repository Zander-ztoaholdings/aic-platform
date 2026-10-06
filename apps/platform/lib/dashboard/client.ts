/**
 * The client dashboard: the organisation's AI exposure at a glance.
 *
 * Every figure is read from the record (declared systems, the decision log,
 * usage the organisation's own providers reported, findings, incidents,
 * checks and the registers). Sections that fail to load (a migration not yet
 * applied) come back null and the page leaves them out.
 */
import {
  getTenantDb, decisionRecords, llmUsageRecords, incidents, agentRuns,
  and, eq, gte, inArray, sql,
} from '@aic/db';
import { buildOrgOverview, DIVISION_NAMES } from '@/lib/org-overview';
import { readContinuity } from '@/lib/continuity-store';
import { registerFacts } from '@/lib/registers/facts';

const DAY = 86_400_000;
const safe = async <T>(f: () => Promise<T>): Promise<T | null> => { try { return await f(); } catch { return null; } };

export async function getClientDashboard(orgId: string, now = new Date()) {
  const db = getTenantDb(orgId);
  const since30 = new Date(now.getTime() - 30 * DAY);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const prevMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();

  const [overview, record, facts, decisions, spend, openIncidents, agentsWaiting] = await Promise.all([
    buildOrgOverview(orgId),
    safe(() => readContinuity(orgId, 6)),
    safe(() => registerFacts(orgId)),
    safe(() => db.query(async (tx) => ({
      byDay: await tx.select({ day: sql<string>`to_char(date_trunc('day', ${decisionRecords.createdAt} at time zone 'UTC'), 'YYYY-MM-DD')`, n: sql<number>`count(*)::int`, overrides: sql<number>`count(*) filter (where ${decisionRecords.isHumanOverride})::int` })
        .from(decisionRecords).where(and(eq(decisionRecords.orgId, orgId), gte(decisionRecords.createdAt, since30))).groupBy(sql`1`),
      bySystem: await tx.select({ name: decisionRecords.systemName, n: sql<number>`count(*)::int` })
        .from(decisionRecords).where(and(eq(decisionRecords.orgId, orgId), gte(decisionRecords.createdAt, since30))).groupBy(decisionRecords.systemName).orderBy(sql`2 desc`).limit(6),
      pending: await tx.select({ n: sql<number>`count(*)::int`, overdue: sql<number>`count(*) filter (where ${decisionRecords.reviewDueAt} < now())::int` })
        .from(decisionRecords).where(and(eq(decisionRecords.orgId, orgId), eq(decisionRecords.reviewStatus, 'pending'))),
    }))),
    safe(() => db.query(async (tx) => ({
      byDay: await tx.select({ day: sql<string>`to_char(date_trunc('day', ${llmUsageRecords.periodStart} at time zone 'UTC'), 'YYYY-MM-DD')`, n: sql<number>`coalesce(sum(${llmUsageRecords.costUsd}), 0)::float` })
        .from(llmUsageRecords).where(and(eq(llmUsageRecords.orgId, orgId), gte(llmUsageRecords.periodStart, since30))).groupBy(sql`1`),
      month: await tx.select({ n: sql<number>`coalesce(sum(${llmUsageRecords.costUsd}), 0)::float` }).from(llmUsageRecords).where(and(eq(llmUsageRecords.orgId, orgId), gte(llmUsageRecords.periodStart, monthStart))),
      prev: await tx.select({ n: sql<number>`coalesce(sum(${llmUsageRecords.costUsd}), 0)::float` }).from(llmUsageRecords)
        .where(and(eq(llmUsageRecords.orgId, orgId), gte(llmUsageRecords.periodStart, prevMonthStart), sql`${llmUsageRecords.periodStart} < ${monthStart}`)),
      byProvider: await tx.select({ provider: llmUsageRecords.provider, n: sql<number>`coalesce(sum(${llmUsageRecords.costUsd}), 0)::float` })
        .from(llmUsageRecords).where(and(eq(llmUsageRecords.orgId, orgId), gte(llmUsageRecords.periodStart, monthStart))).groupBy(llmUsageRecords.provider),
    }))),
    safe(() => db.query(async (tx) => (await tx.select({ n: sql<number>`count(*)::int` }).from(incidents).where(and(eq(incidents.orgId, orgId), inArray(incidents.status, ['OPEN', 'INVESTIGATING']))))[0].n)),
    safe(() => db.query(async (tx) => (await tx.select({ n: sql<number>`count(*)::int` }).from(agentRuns).where(and(eq(agentRuns.orgId, orgId), eq(agentRuns.status, 'waiting_for_person'))))[0].n)),
  ]);
  if (!overview) return null;

  const systems = overview.inventory.systems;
  const byDivision = Object.entries(DIVISION_NAMES).map(([k, name]) => ({ division: Number(k), name, n: systems.filter((s) => s.division === Number(k)).length }));
  const decided30 = decisions ? decisions.byDay.reduce((a, r) => a + Number(r.n), 0) : null;
  const overrides30 = decisions ? decisions.byDay.reduce((a, r) => a + Number(r.overrides), 0) : null;
  const monthToDate = spend ? Number(spend.month[0]?.n ?? 0) : null;
  const dayOfMonth = now.getUTCDate();
  const checks = overview.checks;

  return {
    org: overview.organisation,
    certificate: overview.certificate,
    systems: {
      total: overview.inventory.total,
      inProduction: overview.inventory.inProduction,
      byDivision,
      byTier: [1, 2, 3, 4, 5].map((t) => ({ tier: t, n: systems.filter((s) => s.riskTier === t).length })),
      undeclared: [...overview.inventory.undeclaredButDeciding.map((u) => u.name), ...overview.usage.undeclaredAttributions.map((u) => u.name)].filter((v, i, a) => v && a.indexOf(v) === i) as string[],
      withoutPurpose: overview.inventory.withoutStatedPurpose,
    },
    decisions: decisions && {
      byDay: decisions.byDay.map((r) => ({ day: r.day, n: Number(r.n) })),
      total30: decided30!, overrides30: overrides30!,
      bySystem: decisions.bySystem.map((r) => ({ label: r.name ?? 'Unnamed', n: Number(r.n) })),
      pendingReview: Number(decisions.pending[0]?.n ?? 0), overdueReview: Number(decisions.pending[0]?.overdue ?? 0),
      allTime: overview.decisions.recorded,
    },
    spend: spend && {
      hasData: overview.usage.byProviderModel.length > 0,
      byDay: spend.byDay.map((r) => ({ day: r.day, n: Number(r.n) })),
      monthToDate: monthToDate!,
      lastMonth: Number(spend.prev[0]?.n ?? 0),
      // A straight-line projection, stated as such on the page; not shown in the first three days.
      projected: dayOfMonth >= 4 ? (monthToDate! / dayOfMonth) * daysInMonth : null,
      byProvider: spend.byProvider.map((r) => ({ provider: r.provider, n: Number(r.n) })).sort((a, b) => b.n - a.n),
    },
    issues: {
      findingsOpen: overview.findings.openCount,
      findingsOverdue: overview.findings.overdueCount,
      incidentsOpen: openIncidents,
      checksFailing: checks.filter((c) => c.status === 'fail').length,
      checksWarning: checks.filter((c) => c.status === 'warn').length,
      checksTotal: checks.length,
    },
    readiness: {
      requirements: overview.requirements,
      accountablePersons: overview.accountability.onRecord,
      registers: facts ?? {},
    },
    gaps: overview.gaps,
    agentsWaiting,
    record: record && { chainOk: record.chain.valid, total: record.total, lastObservedAt: record.lastObservedAt, events: record.events, drift: record.drift.length },
  };
}

export type ClientDashboard = NonNullable<Awaited<ReturnType<typeof getClientDashboard>>>;
