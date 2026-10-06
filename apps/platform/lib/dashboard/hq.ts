import {
  getSystemDb, sql, eq, and, gte, gt, ne, isNull, count,
  leads, organizations, issuedCertifications, newsletterSubscribers, aiSystems, decisionRecords,
  accountablePersons, auditDocuments, hqJurisdictions,
} from '@aic/db';
import type { AnyColumn } from 'drizzle-orm';
import { summarise, todayIso, type Stage } from '@/lib/markets';

/**
 * Figures for the HQ front door (app/(modules)/hq/governance/page.tsx).
 *
 * Every number is a count of rows in the database; nothing is estimated and
 * there are no targets. Each section is read on its own and comes back null if
 * its query fails (a table not yet migrated, for instance), so the page can
 * leave that tile out rather than show a zero that is not true.
 *
 * The demo company (lib/demo/highveld.ts) is not a client, so it is left out
 * of every client and register figure.
 */

/** lib/demo/highveld.ts DEMO_ORG_ID, copied so this module does not pull in the demo builder's imports. */
const DEMO_ORG_ID = 'de300000-0000-4000-8000-0000000000a1';

const DAY = 86_400_000;
const DAYS = 30;

/** Lead statuses that have left the pipeline, one way or the other. */
const CLOSED_LEAD_STATUSES = ['CERTIFIED', 'LOST'];

async function safe<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[hq dashboard] ${label} unavailable:`, err instanceof Error ? err.message : err);
    return null;
  }
}

const n = (v: unknown) => Number(v ?? 0) || 0;
const utcDay = (col: unknown) => sql<string>`to_char((${col} at time zone 'UTC')::date, 'YYYY-MM-DD')`;

export type HqDashboard = {
  leads: { total: number; last30: number; daily: { day: string; n: number }[]; open: number; byStatus: { status: string; n: number }[] } | null;
  clients: { total: number; paying: number; pastDue: number } | null;
  certified: { orgs: number } | null;
  subscribers: { active: number; last30: number } | null;
  register: { systems: number; byRiskTier: { tier: number | null; n: number }[] } | null;
  decisions: { last30: number; daily: { day: string; n: number }[]; awaitingReview: number; overdueReview: number } | null;
  accountability: { orgsWithout: number } | null;
  evidence: { byOutcome: { outcome: string; n: number }[]; awaitingDecision: number } | null;
  markets: { counts: Record<Stage, number>; total: number; overdue: { id: string; name: string; nextStep: string | null; nextStepDue: string }[] } | null;
};

export async function getHqDashboard(now = new Date()): Promise<HqDashboard> {
  const db = getSystemDb();
  const since = new Date(now.getTime() - (DAYS - 1) * DAY);
  since.setUTCHours(0, 0, 0, 0);
  const notDemo = (col: AnyColumn) => sql`(${col} is null or ${col} <> ${DEMO_ORG_ID})`;

  const [leadData, clients, certified, subscribers, register, decisions, accountability, evidence, markets] = await Promise.all([
    safe('leads', async () => {
      const byStatus = await db
        .select({ status: sql<string>`coalesce(${leads.status}, 'NEW')`, n: count() })
        .from(leads)
        .groupBy(sql`coalesce(${leads.status}, 'NEW')`);
      const daily = await db
        .select({ day: utcDay(leads.createdAt), n: count() })
        .from(leads)
        .where(gte(leads.createdAt, since))
        .groupBy(utcDay(leads.createdAt));
      const rows = byStatus.map((r) => ({ status: r.status, n: n(r.n) })).sort((a, b) => b.n - a.n);
      return {
        total: rows.reduce((a, r) => a + r.n, 0),
        last30: daily.reduce((a, r) => a + n(r.n), 0),
        daily: daily.map((r) => ({ day: r.day, n: n(r.n) })),
        open: rows.filter((r) => !CLOSED_LEAD_STATUSES.includes(r.status)).reduce((a, r) => a + r.n, 0),
        byStatus: rows,
      };
    }),

    safe('clients', async () => {
      const [r] = await db
        .select({
          total: count(),
          paying: sql<number>`count(*) filter (where ${organizations.billingStatus} = 'ACTIVE')`,
          pastDue: sql<number>`count(*) filter (where ${organizations.billingStatus} = 'PAST_DUE')`,
        })
        .from(organizations)
        .where(ne(organizations.id, DEMO_ORG_ID));
      return { total: n(r?.total), paying: n(r?.paying), pastDue: n(r?.pastDue) };
    }),

    // A certificate counts while it is ACTIVE and inside its own expiry date.
    safe('certifications', async () => {
      const [r] = await db
        .select({ orgs: sql<number>`count(distinct ${issuedCertifications.orgId})` })
        .from(issuedCertifications)
        .where(and(eq(issuedCertifications.status, 'ACTIVE'), gt(issuedCertifications.expiryDate, now), notDemo(issuedCertifications.orgId)));
      return { orgs: n(r?.orgs) };
    }),

    safe('subscribers', async () => {
      const [r] = await db
        .select({
          active: sql<number>`count(*) filter (where coalesce(${newsletterSubscribers.status}, 'ACTIVE') = 'ACTIVE')`,
          last30: sql<number>`count(*) filter (where ${newsletterSubscribers.subscribedAt} >= ${since} and coalesce(${newsletterSubscribers.status}, 'ACTIVE') = 'ACTIVE')`,
        })
        .from(newsletterSubscribers);
      return { active: n(r?.active), last30: n(r?.last30) };
    }),

    // Declared systems that are still in use, across every client.
    safe('ai systems', async () => {
      const rows = await db
        .select({ tier: aiSystems.riskTier, n: count() })
        .from(aiSystems)
        .where(and(sql`coalesce(${aiSystems.isActive}, true)`, notDemo(aiSystems.orgId)))
        .groupBy(aiSystems.riskTier);
      const byRiskTier = rows.map((r) => ({ tier: r.tier, n: n(r.n) })).sort((a, b) => (a.tier ?? 99) - (b.tier ?? 99));
      return { systems: byRiskTier.reduce((a, r) => a + r.n, 0), byRiskTier };
    }),

    safe('decisions', async () => {
      const daily = await db
        .select({ day: utcDay(decisionRecords.createdAt), n: count() })
        .from(decisionRecords)
        .where(and(gte(decisionRecords.createdAt, since), notDemo(decisionRecords.orgId)))
        .groupBy(utcDay(decisionRecords.createdAt));
      const [q] = await db
        .select({
          awaiting: sql<number>`count(*) filter (where ${decisionRecords.reviewStatus} = 'pending')`,
          overdue: sql<number>`count(*) filter (where ${decisionRecords.reviewStatus} = 'pending' and ${decisionRecords.reviewDueAt} < ${now})`,
        })
        .from(decisionRecords)
        .where(notDemo(decisionRecords.orgId));
      return {
        last30: daily.reduce((a, r) => a + n(r.n), 0),
        daily: daily.map((r) => ({ day: r.day, n: n(r.n) })),
        awaitingReview: n(q?.awaiting),
        overdueReview: n(q?.overdue),
      };
    }),

    // Client organisations with no current (unsuperseded) accountable person.
    safe('accountable persons', async () => {
      const [r] = await db
        .select({ n: count() })
        .from(organizations)
        .where(and(
          ne(organizations.id, DEMO_ORG_ID),
          sql`not exists (select 1 from ${accountablePersons} where ${accountablePersons.orgId} = ${organizations.id} and ${accountablePersons.supersededAt} is null)`,
        ));
      return { orgsWithout: n(r?.n) };
    }),

    // Evidence decisions recorded in the last 30 days, and current evidence nobody has decided on.
    safe('evidence', async () => {
      const rows = await db
        .select({ outcome: auditDocuments.verificationOutcome, n: count() })
        .from(auditDocuments)
        .where(gte(auditDocuments.verifiedAt, since))
        .groupBy(auditDocuments.verificationOutcome);
      const [q] = await db
        .select({ n: count() })
        .from(auditDocuments)
        .where(and(isNull(auditDocuments.verifiedAt), isNull(auditDocuments.supersededBy), notDemo(auditDocuments.orgId)));
      return {
        byOutcome: rows.filter((r) => r.outcome).map((r) => ({ outcome: r.outcome as string, n: n(r.n) })),
        awaitingDecision: n(q?.n),
      };
    }),

    // hq_jurisdictions arrives with migration 017.
    safe('markets', async () => {
      const rows = await db
        .select({ id: hqJurisdictions.id, name: hqJurisdictions.name, stage: hqJurisdictions.stage, nextStep: hqJurisdictions.nextStep, nextStepDue: hqJurisdictions.nextStepDue })
        .from(hqJurisdictions);
      return summarise(rows, todayIso());
    }),
  ]);

  return { leads: leadData, clients, certified, subscribers, register, decisions, accountability, evidence, markets };
}

export { DAYS };
