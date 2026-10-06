import {
  getSystemDb, sql, eq, and, gte, lt, lte, gt, ne, isNull, inArray, count, desc, asc,
  organizations, auditDocuments, scheduledAudits, alphaApplications, auditFindings, aiSystems,
  decisionRecords, connectorRuns, issuedCertifications, aimsAssessments, conflictChecks,
} from '@aic/db';
import type { AnyColumn } from 'drizzle-orm';

/**
 * Figures for the AIC staff home (app/(modules)/admin/page.tsx).
 *
 * Staff work across client files, so this reads through getSystemDb(). Every
 * figure is a count of rows; nothing is estimated. Each section is read on its
 * own and comes back null if it was not asked for (the person lacks the
 * capability) or its query failed (a table not yet migrated), so the page
 * leaves that tile out rather than show a zero that is not true.
 *
 * The demo company (lib/demo/highveld.ts) is not a client and is left out.
 */

/** lib/demo/highveld.ts DEMO_ORG_ID, copied so this module does not pull in the demo builder's imports. */
const DEMO_ORG_ID = 'de300000-0000-4000-8000-0000000000a1';
const DAY = 86_400_000;
export const DECISION_DAYS = 30;

async function safe<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[staff dashboard] ${label} unavailable:`, err instanceof Error ? err.message : err);
    return null;
  }
}

const n = (v: unknown) => Number(v ?? 0) || 0;
const utcDay = (col: unknown) => sql<string>`to_char((${col} at time zone 'UTC')::date, 'YYYY-MM-DD')`;
const notDemo = (col: AnyColumn) => sql`(${col} is null or ${col} <> ${DEMO_ORG_ID})`;

export type StaffCaps = {
  conductAssessment: boolean;
  viewAllOrgs: boolean;
  approveCertification: boolean;
  issueCertification: boolean;
  clearConflict: boolean;
};

export type StaffDashboard = {
  queue: { waiting: number } | null;
  audits: { next14: number; soonest: Date | null } | null;
  applications: { waiting: number; total: number } | null;
  findings: { overdue: number; open: number; responsesToReview: number } | null;
  systems: { total: number; tier1: number; orgs: number } | null;
  decisions: { last30: number; daily: { day: string; n: number }[]; overrides: number; orgs: number } | null;
  undeclared: { systems: number; orgs: number } | null;
  connectors: { errors: number; orgs: number } | null;
  orgStatus: { status: string | null; n: number }[] | null;
  expiring: { total: number; rows: { id: string; org: string; certNumber: string; expiry: Date }[] } | null;
  mostActive: { org: string; n: number }[] | null;
  stage2: number | null;
  pendingReview: number | null;
  awaitingIssue: number | null;
  conflicts: number | null;
};

export async function getStaffDashboard(caps: StaffCaps, now = new Date()): Promise<StaffDashboard> {
  const db = getSystemDb();
  const since = new Date(now.getTime() - (DECISION_DAYS - 1) * DAY);
  since.setUTCHours(0, 0, 0, 0);
  const in14 = new Date(now.getTime() + 14 * DAY);
  const in90 = new Date(now.getTime() + 90 * DAY);
  const ago7 = new Date(now.getTime() - 7 * DAY);
  const skip = <T,>(): Promise<T | null> => Promise.resolve(null);
  const certReader = caps.conductAssessment || caps.viewAllOrgs;

  const [queue, audits, applications, findings, systems, decisions, undeclared, connectors, orgStatus, expiring, mostActive, stage2, pendingReview, awaitingIssue, conflicts] = await Promise.all([
    // Current evidence nobody has decided on: not verified, not superseded.
    caps.conductAssessment ? safe('queue', async () => {
      const [r] = await db.select({ n: count() }).from(auditDocuments)
        .where(and(isNull(auditDocuments.verifiedAt), isNull(auditDocuments.supersededBy), notDemo(auditDocuments.orgId)));
      return { waiting: n(r?.n) };
    }) : skip<StaffDashboard['queue']>(),

    caps.conductAssessment ? safe('audits', async () => {
      const [r] = await db.select({ n: count(), soonest: sql<string | null>`min(${scheduledAudits.scheduledAt})` }).from(scheduledAudits)
        .where(and(eq(scheduledAudits.status, 'SCHEDULED'), gte(scheduledAudits.scheduledAt, now), lte(scheduledAudits.scheduledAt, in14), notDemo(scheduledAudits.orgId)));
      return { next14: n(r?.n), soonest: r?.soonest ? new Date(r.soonest) : null };
    }) : skip<StaffDashboard['audits']>(),

    caps.conductAssessment ? safe('applications', async () => {
      const [r] = await db.select({
        total: count(),
        waiting: sql<number>`count(*) filter (where coalesce(${alphaApplications.status}, 'PENDING') = 'PENDING')`,
      }).from(alphaApplications);
      return { waiting: n(r?.waiting), total: n(r?.total) };
    }) : skip<StaffDashboard['applications']>(),

    // Open means OPEN or RESPONSE_SUBMITTED, as the findings screens count it.
    caps.conductAssessment ? safe('findings', async () => {
      const [r] = await db.select({
        open: count(),
        overdue: sql<number>`count(*) filter (where ${auditFindings.dueAt} < ${now})`,
        responses: sql<number>`count(*) filter (where ${auditFindings.status} = 'RESPONSE_SUBMITTED')`,
      }).from(auditFindings)
        .where(and(inArray(auditFindings.status, ['OPEN', 'RESPONSE_SUBMITTED']), notDemo(auditFindings.orgId)));
      return { overdue: n(r?.overdue), open: n(r?.open), responsesToReview: n(r?.responses) };
    }) : skip<StaffDashboard['findings']>(),

    caps.viewAllOrgs ? safe('ai systems', async () => {
      const [r] = await db.select({
        total: count(),
        tier1: sql<number>`count(*) filter (where ${aiSystems.riskTier} = 1)`,
        orgs: sql<number>`count(distinct ${aiSystems.orgId})`,
      }).from(aiSystems)
        .where(and(sql`coalesce(${aiSystems.isActive}, true)`, notDemo(aiSystems.orgId)));
      return { total: n(r?.total), tier1: n(r?.tier1), orgs: n(r?.orgs) };
    }) : skip<StaffDashboard['systems']>(),

    caps.viewAllOrgs ? safe('decisions', async () => {
      const where = and(gte(decisionRecords.createdAt, since), notDemo(decisionRecords.orgId));
      const daily = await db.select({ day: utcDay(decisionRecords.createdAt), n: count() }).from(decisionRecords)
        .where(where).groupBy(utcDay(decisionRecords.createdAt));
      const [r] = await db.select({
        overrides: sql<number>`count(*) filter (where ${decisionRecords.isHumanOverride} = true)`,
        orgs: sql<number>`count(distinct ${decisionRecords.orgId})`,
      }).from(decisionRecords).where(where);
      return {
        last30: daily.reduce((a, d) => a + n(d.n), 0),
        daily: daily.map((d) => ({ day: d.day, n: n(d.n) })),
        overrides: n(r?.overrides),
        orgs: n(r?.orgs),
      };
    }) : skip<StaffDashboard['decisions']>(),

    // A system name that has logged a decision but matches no active declared
    // system in the same organisation — the comparison lib/org-overview.ts makes
    // for one organisation, made here across all of them.
    caps.viewAllOrgs ? safe('undeclared', async () => {
      const res = await db.execute(sql`
        select count(*)::int as systems, count(distinct x.org_id)::int as orgs
        from (
          select distinct d.org_id, lower(trim(d.system_name)) as name
          from ${decisionRecords} d
          where (d.org_id is null or d.org_id <> ${DEMO_ORG_ID})
            and d.system_name is not null and trim(d.system_name) <> ''
            and not exists (
              select 1 from ${aiSystems} s
              where s.org_id = d.org_id and coalesce(s.is_active, true)
                and lower(trim(s.name)) = lower(trim(d.system_name))
            )
        ) x
      `);
      const r = (res.rows?.[0] ?? {}) as { systems?: unknown; orgs?: unknown };
      return { systems: n(r.systems), orgs: n(r.orgs) };
    }) : skip<StaffDashboard['undeclared']>(),

    // connector_runs arrives with migration 017.
    caps.viewAllOrgs ? safe('connector runs', async () => {
      const [r] = await db.select({ errors: count(), orgs: sql<number>`count(distinct ${connectorRuns.orgId})` }).from(connectorRuns)
        .where(and(eq(connectorRuns.outcome, 'error'), gte(connectorRuns.ranAt, ago7), eq(connectorRuns.demo, false), notDemo(connectorRuns.orgId)));
      return { errors: n(r?.errors), orgs: n(r?.orgs) };
    }) : skip<StaffDashboard['connectors']>(),

    caps.viewAllOrgs ? safe('organisations by status', async () => {
      const rows = await db.select({ status: organizations.certificationStatus, n: count() }).from(organizations)
        .where(ne(organizations.id, DEMO_ORG_ID)).groupBy(organizations.certificationStatus);
      return rows.map((r) => ({ status: r.status, n: n(r.n) }));
    }) : skip<StaffDashboard['orgStatus']>(),

    certReader ? safe('expiring certificates', async () => {
      const where = and(eq(issuedCertifications.status, 'ACTIVE'), gt(issuedCertifications.expiryDate, now), lt(issuedCertifications.expiryDate, in90), notDemo(issuedCertifications.orgId));
      const rows = await db.select({ id: issuedCertifications.id, org: organizations.name, certNumber: issuedCertifications.certNumber, expiry: issuedCertifications.expiryDate })
        .from(issuedCertifications).leftJoin(organizations, eq(issuedCertifications.orgId, organizations.id))
        .where(where).orderBy(asc(issuedCertifications.expiryDate)).limit(6);
      const [t] = await db.select({ n: count() }).from(issuedCertifications).where(where);
      return { total: n(t?.n), rows: rows.map((r) => ({ id: r.id, org: r.org ?? 'Unnamed organisation', certNumber: r.certNumber, expiry: r.expiry })) };
    }) : skip<StaffDashboard['expiring']>(),

    caps.viewAllOrgs ? safe('most active clients', async () => {
      const rows = await db.select({ org: organizations.name, n: count() }).from(decisionRecords)
        .innerJoin(organizations, eq(decisionRecords.orgId, organizations.id))
        .where(and(gte(decisionRecords.createdAt, since), ne(organizations.id, DEMO_ORG_ID)))
        .groupBy(organizations.id, organizations.name).orderBy(desc(count())).limit(6);
      return rows.map((r) => ({ org: r.org, n: n(r.n) }));
    }) : skip<StaffDashboard['mostActive']>(),

    // AIMS files at stage 2: the stage whose next step is CERTIFIED (lib/state-machine.ts).
    caps.approveCertification ? safe('aims stage 2', async () => {
      const [r] = await db.select({ n: count() }).from(aimsAssessments)
        .where(and(eq(aimsAssessments.stage, 'STAGE_2_TECHNICAL'), notDemo(aimsAssessments.orgId)));
      return n(r?.n);
    }) : skip<number>(),

    caps.approveCertification ? safe('pending review', async () => {
      const [r] = await db.select({ n: count() }).from(organizations)
        .where(and(eq(organizations.certificationStatus, 'PENDING_REVIEW'), ne(organizations.id, DEMO_ORG_ID)));
      return n(r?.n);
    }) : skip<number>(),

    caps.issueCertification ? safe('awaiting issue', async () => {
      const [r] = await db.select({ n: count() }).from(organizations)
        .where(and(eq(organizations.certificationStatus, 'APPROVED'), ne(organizations.id, DEMO_ORG_ID)));
      return n(r?.n);
    }) : skip<number>(),

    // Declarations the claim route refused (status BLOCKED); a super admin reviews them.
    caps.clearConflict ? safe('conflict declarations', async () => {
      const [r] = await db.select({ n: count() }).from(conflictChecks)
        .where(and(eq(conflictChecks.status, 'BLOCKED'), notDemo(conflictChecks.orgId)));
      return n(r?.n);
    }) : skip<number>(),
  ]);

  return { queue, audits, applications, findings, systems, decisions, undeclared, connectors, orgStatus, expiring, mostActive, stage2, pendingReview, awaitingIssue, conflicts };
}
