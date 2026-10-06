/**
 * Server side of the live risk register: gathers what AIC observes for an
 * organisation (lib/registers/risk-signals turns it into signals), and reads
 * and writes the parts of the register migration 018 adds.
 *
 * Everything that touches 018's columns or tables tolerates them missing:
 * reads come back empty and writes are skipped, so the register works as
 * before on a server that has not run the migration.
 */
import {
  getTenantDb, getSystemDb, integrationChecks, aiSystems, decisionRecords, llmUsageRecords, suppliers, supplierDocumentReads,
  auditFindings, accessReviews, organizations, riskTracking, riskEvents, riskSignalDismissals,
  and, eq, desc, gt, isNotNull, inArray, sql,
} from '@aic/db';
import { COMMON_CONTROLS } from '../common-controls';
import { CONNECTOR_CHECKS } from '../connectors/catalog';
import { CHECK_BY_KEY } from '../integrations/catalog';
import { evaluateCommon } from '../controls';
import { gatherEvidence } from '../controls-data';
import { TEMPLATE_BY_KEY } from '../policy-templates';
import { summariseSpend, type UsageRow } from '../spend';
import { adviseModels, type ModelUsage } from '../spend-switch';
import { supplierFlags, documentConcerns } from './suppliers';
import { emptyObservations, type ControlState, type RiskObservations } from './risk-signals';
import type { RiskEventDraft } from './risk';

const DAY = 86_400_000;

/** Postgres: relation (42P01) or column (42703) does not exist, so a migration has not been applied. */
export const isNotMigrated = (e: unknown) => {
  const x = e as { code?: string; cause?: { code?: string } };
  const code = x.code ?? x.cause?.code;
  return code === '42P01' || code === '42703';
};

/** Check key to the common controls it evidences: a connector's own list first (its main control leads), then the catalogue. */
const CONTROLS_BY_CHECK = (() => {
  const m = new Map<string, string[]>();
  for (const k of CONNECTOR_CHECKS) m.set(k.key, [...k.common]);
  for (const c of COMMON_CONTROLS) for (const s of c.sources) {
    if (s.kind !== 'check') continue;
    const list = m.get(s.key) ?? [];
    if (!list.includes(c.key)) m.set(s.key, [...list, c.key]);
  }
  return m;
})();

/** Runs one read, returning `fallback` when its table is missing or it fails. Each read gets its own transaction so one failure cannot poison the rest. */
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch (e) { if (!isNotMigrated(e)) console.error('[risk-observe]', e); return fallback; }
}

export type Observed = { observations: RiskObservations; controls: Record<string, ControlState> };

/** Everything the signals need, for one organisation. */
export async function observe(orgId: string, now = new Date()): Promise<Observed> {
  const db = getTenantDb(orgId);
  const o = emptyObservations();
  const nowMs = now.getTime();

  // Control states and register facts (suppliers, leavers, access reviews).
  const evidence = await safe(() => gatherEvidence(orgId), null);
  const controls: Record<string, ControlState> = {};
  if (evidence) {
    for (const c of evaluateCommon(evidence, (k) => CHECK_BY_KEY[k]?.title ?? k, (k) => TEMPLATE_BY_KEY[k]?.title ?? k)) controls[c.key] = c.status;
    const f = evidence.facts ?? {};
    if (f.leavers) o.leavers = { status: f.leavers.status, label: f.leavers.label };
    if (f.access_review) o.accessReview = { status: f.access_review.status, label: f.access_review.label };
  }

  const [checks, systems, deciding, using, quiet, sups, reads, findings, reviews, usage] = await Promise.all([
    safe(() => db.query((tx) => tx.select({ checkKey: integrationChecks.checkKey, subject: integrationChecks.subject, summary: integrationChecks.summary })
      .from(integrationChecks).where(and(eq(integrationChecks.orgId, orgId), eq(integrationChecks.status, 'fail')))), []),
    safe(() => db.query((tx) => tx.select({ name: aiSystems.name, riskTier: aiSystems.riskTier, isActive: aiSystems.isActive }).from(aiSystems).where(eq(aiSystems.orgId, orgId))), []),
    safe(() => db.query((tx) => tx.select({ name: decisionRecords.systemName, n: sql<number>`count(*)::int` }).from(decisionRecords)
      .where(eq(decisionRecords.orgId, orgId)).groupBy(decisionRecords.systemName)), []),
    safe(() => db.query((tx) => tx.selectDistinct({ name: llmUsageRecords.systemName, provider: llmUsageRecords.provider }).from(llmUsageRecords)
      .where(and(eq(llmUsageRecords.orgId, orgId), isNotNull(llmUsageRecords.systemName)))), []),
    safe(() => db.query((tx) => tx.select({
      name: decisionRecords.systemName, n: sql<number>`count(*)::int`,
      overrides: sql<number>`(count(*) filter (where ${decisionRecords.isHumanOverride} = true))::int`,
    }).from(decisionRecords).where(and(eq(decisionRecords.orgId, orgId), gt(decisionRecords.createdAt, new Date(nowMs - 90 * DAY)))).groupBy(decisionRecords.systemName)), []),
    safe(() => db.query((tx) => tx.select({ id: suppliers.id, name: suppliers.name, dataShared: suppliers.dataShared, outsideSa: suppliers.outsideSa, hasDpa: suppliers.hasDpa, criticality: suppliers.criticality })
      .from(suppliers).where(and(eq(suppliers.orgId, orgId), eq(suppliers.status, 'active')))), []),
    safe(() => db.query((tx) => tx.select({ supplierId: supplierDocumentReads.supplierId, createdAt: supplierDocumentReads.createdAt, findings: supplierDocumentReads.findings })
      .from(supplierDocumentReads).where(eq(supplierDocumentReads.orgId, orgId))), []),
    safe(() => db.query((tx) => tx.select({ title: auditFindings.title, status: auditFindings.status, dueAt: auditFindings.dueAt }).from(auditFindings).where(eq(auditFindings.orgId, orgId))), []),
    safe(() => db.query((tx) => tx.select({ name: accessReviews.name, status: accessReviews.status, dueAt: accessReviews.dueAt }).from(accessReviews).where(and(eq(accessReviews.orgId, orgId), eq(accessReviews.status, 'open')))), []),
    safe(() => db.query((tx) => tx.select({
      provider: llmUsageRecords.provider, model: llmUsageRecords.model, systemName: llmUsageRecords.systemName, periodStart: llmUsageRecords.periodStart,
      requests: llmUsageRecords.requests, inputTokens: llmUsageRecords.inputTokens, outputTokens: llmUsageRecords.outputTokens, costUsd: llmUsageRecords.costUsd,
    }).from(llmUsageRecords).where(and(eq(llmUsageRecords.orgId, orgId), gt(llmUsageRecords.periodStart, new Date(nowMs - 62 * DAY))))), []),
  ]);

  o.failingChecks = checks.map((c) => ({ checkKey: c.checkKey, title: CHECK_BY_KEY[c.checkKey]?.title ?? c.checkKey, subject: c.subject, summary: c.summary, controls: CONTROLS_BY_CHECK.get(c.checkKey) ?? [] }));

  const declared = new Set(systems.filter((s) => s.isActive !== false).map((s) => s.name.trim().toLowerCase()));
  const seen = new Set<string>();
  for (const d of deciding) {
    const k = d.name?.trim().toLowerCase();
    if (!k || declared.has(k) || seen.has(k)) continue;
    seen.add(k); o.undeclared.push({ name: d.name, decisions: Number(d.n) });
  }
  for (const u of using) {
    const k = u.name?.trim().toLowerCase();
    if (!k || declared.has(k) || seen.has(k)) continue;
    seen.add(k); o.undeclared.push({ name: u.name as string, provider: u.provider });
  }

  // High-risk declared systems (tier 1) deciding at volume with nobody ever overriding.
  const highRisk = new Set(systems.filter((s) => s.isActive !== false && s.riskTier === 1).map((s) => s.name.trim().toLowerCase()));
  o.quietSystems = quiet.filter((q) => highRisk.has(q.name.trim().toLowerCase()) && Number(q.n) >= 50 && Number(q.overrides) === 0).map((q) => ({ name: q.name, decisions: Number(q.n), days: 90 }));

  o.suppliers = sups.map((s) => ({ name: s.name, flags: [...supplierFlags(s), ...documentConcerns(reads.filter((r) => r.supplierId === s.id), nowMs)] })).filter((s) => s.flags.length);

  o.overdueFindings = findings.filter((f) => f.status !== 'CLOSED' && f.status !== 'WITHDRAWN' && f.dueAt && new Date(f.dueAt).getTime() < nowMs)
    .map((f) => ({ title: f.title, dueAt: new Date(f.dueAt!).toISOString() }));
  o.overdueAccessReviews = reviews.filter((r) => r.dueAt && new Date(r.dueAt).getTime() < nowMs).map((r) => ({ name: r.name, dueAt: new Date(r.dueAt!).toISOString() }));

  // Models in use in the last 30 days that their provider is retiring.
  const byModel = new Map<string, ModelUsage>();
  for (const r of usage) {
    if (!r.model || new Date(r.periodStart).getTime() < nowMs - 30 * DAY) continue;
    const u = byModel.get(r.model) ?? { model: r.model, provider: r.provider, cost: 0, requests: 0, inputTokens: 0, outputTokens: 0 };
    u.cost += Number(r.costUsd ?? 0) || 0; u.requests += Number(r.requests ?? 0) || 0;
    u.inputTokens += Number(r.inputTokens ?? 0) || 0; u.outputTokens += Number(r.outputTokens ?? 0) || 0;
    byModel.set(r.model, u);
  }
  o.retiringModels = adviseModels([...byModel.values()], now).filter((a) => a.ending).map((a) => ({ model: a.model, provider: a.provider, ...a.ending! }));

  const budget = await safe(async () => {
    const [org] = await getSystemDb().select({ budget: organizations.aiMonthlyBudgetUsd }).from(organizations).where(eq(organizations.id, orgId)).limit(1);
    return org?.budget ? Number(org.budget) : null;
  }, null);
  if (budget && budget > 0 && usage.length) {
    const s = summariseSpend(usage as UsageRow[], now, budget);
    o.spend = { monthToDate: s.monthToDate, projected: s.projected, budget };
  }

  return { observations: o, controls };
}

// ── 018: tracking columns, events, dismissals ───────────────────────────────

export type Tracking = { source: string; libraryKey: string | null; signalKeys: string[]; acceptedBy: string | null; acceptReason: string | null; acceptUntil: string | null };

/** The 018 columns for every risk, or null before the migration. */
export async function loadTracking(orgId: string): Promise<Map<string, Tracking> | null> {
  try {
    const rows = await getTenantDb(orgId).query((tx) => tx.select().from(riskTracking).where(eq(riskTracking.orgId, orgId)));
    return new Map(rows.map((r) => [r.id, { source: r.source, libraryKey: r.libraryKey, signalKeys: r.signalKeys ?? [], acceptedBy: r.acceptedBy, acceptReason: r.acceptReason, acceptUntil: r.acceptUntil }]));
  } catch (e) {
    if (isNotMigrated(e)) return null;
    throw e;
  }
}

/** Sets 018 columns on a risk. Returns false when the migration has not been applied. */
export async function saveTracking(orgId: string, riskId: string, v: Partial<Omit<Tracking, 'source'>> & { source?: 'manual' | 'library' | 'signal' }): Promise<boolean> {
  if (!Object.keys(v).length) return true;
  try {
    await getTenantDb(orgId).query((tx) => tx.update(riskTracking).set(v).where(and(eq(riskTracking.id, riskId), eq(riskTracking.orgId, orgId))));
    return true;
  } catch (e) {
    if (isNotMigrated(e)) return false;
    throw e;
  }
}

export async function loadDismissals(orgId: string) {
  try {
    return await getTenantDb(orgId).query((tx) => tx.select({ signalKey: riskSignalDismissals.signalKey, subject: riskSignalDismissals.subject, reason: riskSignalDismissals.reason, createdAt: riskSignalDismissals.createdAt })
      .from(riskSignalDismissals).where(eq(riskSignalDismissals.orgId, orgId)).orderBy(desc(riskSignalDismissals.createdAt)));
  } catch (e) {
    if (isNotMigrated(e)) return null;
    throw e;
  }
}

/** Records events on risks. Best effort: before 018 there is nowhere to keep them. */
export async function recordEvents(orgId: string, actorId: string | null, events: (RiskEventDraft & { riskId: string })[]): Promise<boolean> {
  if (!events.length) return true;
  try {
    await getTenantDb(orgId).query((tx) => tx.insert(riskEvents).values(events.map((e) => ({ riskId: e.riskId, orgId, kind: e.kind, detail: e.detail, actorId }))));
    return true;
  } catch (e) {
    if (isNotMigrated(e)) return false;
    throw e;
  }
}

export async function loadEvents(orgId: string, riskId: string) {
  try {
    return await getTenantDb(orgId).query((tx) => tx.select().from(riskEvents).where(and(eq(riskEvents.orgId, orgId), eq(riskEvents.riskId, riskId))).orderBy(desc(riskEvents.createdAt)).limit(200));
  } catch (e) {
    if (isNotMigrated(e)) return null;
    throw e;
  }
}

/** The newest 'signal' event per risk: what AIC last recorded as the current score. */
export async function lastCurrentScores(orgId: string, riskIds: string[]): Promise<Map<string, number> | null> {
  if (!riskIds.length) return new Map();
  try {
    const rows = await getTenantDb(orgId).query((tx) => tx.select({ riskId: riskEvents.riskId, detail: riskEvents.detail, at: riskEvents.createdAt }).from(riskEvents)
      .where(and(eq(riskEvents.orgId, orgId), eq(riskEvents.kind, 'signal'), inArray(riskEvents.riskId, riskIds))).orderBy(desc(riskEvents.createdAt)));
    const m = new Map<string, number>();
    for (const r of rows) {
      const to = (r.detail as { to?: unknown })?.to;
      if (!m.has(r.riskId) && typeof to === 'number') m.set(r.riskId, to);
    }
    return m;
  } catch (e) {
    if (isNotMigrated(e)) return null;
    throw e;
  }
}
