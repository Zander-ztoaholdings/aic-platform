/**
 * Seeds a demonstration organisation for the Friday 18 Sep investor demo.
 *
 * WHY THIS EXISTS AND WHY IT WORKS THE WAY IT DOES.
 *
 * P0 per the PRD (AI Overview & Continuity Record, §8): a believable 2-3 week
 * history, visibly labelled as demo data, real UI/schema behind seeded data -
 * not a screenshot. An empty estate demos as an empty page, and nothing here
 * is a substitute for a real client's data; it exists only so the AI Overview
 * dashboard and the continuity record have something true to show on Friday.
 *
 * It does NOT hand-write estate_events rows. It calls the real
 * observeEstate() pipeline (lib/continuity-store.ts) after each state change,
 * the same function the live app calls - so the hash chain, the drift rules
 * and the event shape are exactly what production produces, not a parallel
 * implementation that could drift from it. observeEstate() takes an optional
 * backdated `observedAt` (added for this script) so the history reads as
 * three real weeks rather than a pile of events all timestamped the moment
 * this ran.
 *
 * The system name "claims-triage-agent" is deliberately never used here - it
 * is reserved for scripts/demo/claims-agent.mjs, which records it live during
 * the demo as a system that is NOT on the inventory. Pre-declaring it here
 * would kill that beat.
 *
 * IDEMPOTENT: safe to run more than once. Org/user/system/person creation is
 * find-or-create, keyed on natural identifiers. observeEstate() itself writes
 * nothing when nothing has changed since the last observation - the same
 * property production relies on - so a second run of this script is a no-op
 * past the first.
 *
 * RUN (needs DATABASE_URL reachable - see the note at the bottom of this
 * file for why that currently means running it from inside the VPS's docker
 * network, not from a laptop):
 *   cd apps/platform && npx tsx scripts/seed-demo-org.ts
 */

import {
  getSystemDb,
  getTenantDb,
  organizations,
  users,
  aiSystems,
  accountablePersons,
  decisionRecords,
  auditFindings,
  eq,
  and,
} from '@aic/db';
import { observeEstate } from '../lib/continuity-store';
import { createHash } from 'crypto';

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS);

const ORG_SLUG = 'karoo-coastal-demo';
const ORG_NAME = 'Karoo Coastal Insurance (Demo)';

function decisionHash(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

async function findOrCreateOrg(sysDb: ReturnType<typeof getSystemDb>) {
  const existing = await sysDb
    .select()
    .from(organizations)
    .where(eq(organizations.slug, ORG_SLUG))
    .limit(1);
  if (existing[0]) return existing[0];

  const [org] = await sysDb
    .insert(organizations)
    .values({
      name: ORG_NAME,
      slug: ORG_SLUG,
      tier: 'TIER_2',
      division: 3,
      standardVersion: 'v0.1',
      accreditationStatus: 'PENDING',
      certificationStatus: 'DRAFT',
      contactEmail: 'demo@karoocoastal-demo.example',
      primaryAiOfficer: 'Naledi Mokoena',
      billingStatus: 'TRIAL',
      publicDirectoryVisible: false,
    })
    .returning();
  return org;
}

async function findOrCreateUser(
  sysDb: ReturnType<typeof getSystemDb>,
  orgId: string | null,
  email: string,
  name: string,
  role: 'ADMIN' | 'AUDITOR' | 'COMPLIANCE_OFFICER' | 'VIEWER'
) {
  const existing = await sysDb.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing[0]) return existing[0];

  const [user] = await sysDb
    .insert(users)
    .values({
      email,
      // Not a real credential - this org is demo-only and nobody signs in as
      // these users. A random hash rather than a known password on purpose.
      passwordHash: decisionHash({ email, salt: Math.random() }),
      name,
      role,
      orgId: orgId ?? undefined,
      isActive: true,
      emailVerified: true,
    })
    .returning();
  return user;
}

async function findOrCreatePerson(
  orgId: string,
  nominatedBy: string,
  name: string,
  jobTitle: string,
  email: string,
  acceptedAt: Date
) {
  const tdb = getTenantDb(orgId);
  return tdb.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(accountablePersons)
      .where(and(eq(accountablePersons.orgId, orgId), eq(accountablePersons.email, email)))
      .limit(1);
    if (existing[0]) return existing[0];

    const [person] = await tx
      .insert(accountablePersons)
      .values({
        orgId,
        nominatedBy,
        name,
        jobTitle,
        email,
        declarationVersion: 'v1',
        declarationAcceptedAt: acceptedAt,
      })
      .returning();
    return person;
  });
}

type SystemSpec = {
  name: string;
  version?: string;
  purpose: string | null;
  division: number;
  riskTier: number;
  lifecycleStage: string;
  status: string;
  isSandbox: boolean;
};

async function findOrCreateSystem(orgId: string, spec: SystemSpec) {
  const tdb = getTenantDb(orgId);
  return tdb.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(aiSystems)
      .where(and(eq(aiSystems.orgId, orgId), eq(aiSystems.name, spec.name)))
      .limit(1);
    if (existing[0]) return existing[0];

    const [sys] = await tx
      .insert(aiSystems)
      .values({
        orgId,
        name: spec.name,
        version: spec.version ?? '1.0.0',
        purpose: spec.purpose,
        division: spec.division,
        riskTier: spec.riskTier,
        lifecycleStage: spec.lifecycleStage,
        status: spec.status,
        isSandbox: spec.isSandbox,
      })
      .returning();
    return sys;
  });
}

async function setSystemField(orgId: string, name: string, patch: Partial<SystemSpec>) {
  const tdb = getTenantDb(orgId);
  await tdb.transaction(async (tx) => {
    await tx.update(aiSystems).set(patch as object).where(and(eq(aiSystems.orgId, orgId), eq(aiSystems.name, name)));
  });
}

async function logDecisions(
  orgId: string,
  systemName: string,
  count: number,
  around: Date,
  overrideEvery = 0
) {
  const tdb = getTenantDb(orgId);
  await tdb.transaction(async (tx) => {
    for (let i = 0; i < count; i++) {
      const at = new Date(around.getTime() + i * 37 * 60 * 1000); // spread through the day
      const input = { ref: `${systemName.toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}` };
      const outcome = { decision: i % 5 === 0 ? 'FLAGGED' : 'APPROVED' };
      const isOverride = overrideEvery > 0 && i > 0 && i % overrideEvery === 0;
      await tx.insert(decisionRecords).values({
        orgId,
        systemName,
        inputParams: input,
        outcome,
        explanation: isOverride
          ? 'Overridden on manual review - amount above the automatic-approval threshold.'
          : null,
        integrityHash: decisionHash({ systemName, input, outcome, at: at.toISOString() }),
        isHumanOverride: isOverride,
        createdAt: at,
      });
    }
  });
}

async function main() {
  const sysDb = getSystemDb();

  const org = await findOrCreateOrg(sysDb);
  console.log(`Org: ${org.name} (${org.id})`);

  const naledi = await findOrCreateUser(
    sysDb,
    org.id,
    'naledi.mokoena@karoocoastal-demo.example',
    'Naledi Mokoena',
    'ADMIN'
  );
  const pieter = await findOrCreateUser(
    sysDb,
    org.id,
    'pieter.vanwyk@karoocoastal-demo.example',
    'Pieter van Wyk',
    'COMPLIANCE_OFFICER'
  );
  const assessor = await findOrCreateUser(
    sysDb,
    null,
    'assessor@aiccertified.cloud.demo',
    'AIC Assessor (Demo)',
    'AUDITOR'
  );

  // ── Day -18: the org signs up. Two accountable persons, four declared
  //    systems - one of them (underwriting-assist) missing its purpose on
  //    purpose, one of them (policy-renewal-optimiser) declared in production
  //    but never wired to log a decision, both left that way deliberately so
  //    the drift they cause is real rather than narrated.
  await findOrCreatePerson(
    org.id,
    naledi.id,
    'Naledi Mokoena',
    'Head of Risk & Compliance',
    'naledi.mokoena@karoocoastal-demo.example',
    daysAgo(18)
  );
  await findOrCreatePerson(
    org.id,
    pieter.id,
    'Pieter van Wyk',
    'CTO',
    'pieter.vanwyk@karoocoastal-demo.example',
    daysAgo(18)
  );

  await findOrCreateSystem(org.id, {
    name: 'fraud-scoring-agent',
    purpose: 'Scores incoming claims for likely fraud indicators before a human adjuster reviews them.',
    division: 3,
    riskTier: 3,
    lifecycleStage: 'PRODUCTION',
    status: 'ACTIVE',
    isSandbox: false,
  });
  await findOrCreateSystem(org.id, {
    name: 'underwriting-assist',
    purpose: null, // filled in on day -9, below
    division: 3,
    riskTier: 3,
    lifecycleStage: 'PRODUCTION',
    status: 'ACTIVE',
    isSandbox: false,
  });
  await findOrCreateSystem(org.id, {
    name: 'customer-support-chatbot',
    purpose: 'Answers policyholder questions about cover and claim status; escalates anything it is not confident about.',
    division: 4,
    riskTier: 1,
    lifecycleStage: 'DEVELOPMENT',
    status: 'DRAFT',
    isSandbox: true,
  });
  await findOrCreateSystem(org.id, {
    name: 'policy-renewal-optimiser',
    purpose: 'Recommends renewal pricing adjustments for the underwriting team to approve.',
    division: 3,
    riskTier: 2,
    lifecycleStage: 'PRODUCTION',
    status: 'ACTIVE',
    isSandbox: false,
    // Deliberately never logs a decision - see DRIFT-SILENT-PRODUCTION-SYSTEM.
  });

  let r = await observeEstate(org.id, 'AIC continuity observer', null, daysAgo(18));
  console.log(`Day -18 observation: ${r?.eventsWritten ?? 0} events, ${r?.drift.length ?? 0} drift condition(s)`);

  // ── Day -15: fraud-scoring-agent and underwriting-assist start deciding.
  //    invoice-matching-bot ALSO starts deciding, but nobody has declared it.
  await logDecisions(org.id, 'fraud-scoring-agent', 6, daysAgo(15));
  await logDecisions(org.id, 'underwriting-assist', 5, daysAgo(15));
  await logDecisions(org.id, 'invoice-matching-bot', 3, daysAgo(15));
  r = await observeEstate(org.id, 'AIC continuity observer', null, daysAgo(15));
  console.log(`Day -15 observation: ${r?.eventsWritten ?? 0} events`);

  // ── Day -12: invoice-matching-bot keeps deciding, still undeclared - this
  //    is what DRIFT-UNDECLARED-GROWING actually watches for.
  await logDecisions(org.id, 'fraud-scoring-agent', 4, daysAgo(12));
  await logDecisions(org.id, 'underwriting-assist', 3, daysAgo(12));
  await logDecisions(org.id, 'invoice-matching-bot', 7, daysAgo(12));
  r = await observeEstate(org.id, 'AIC continuity observer', null, daysAgo(12));
  console.log(`Day -12 observation: ${r?.eventsWritten ?? 0} events, ${r?.drift.length ?? 0} drift condition(s)`);

  // ── Day -9: underwriting-assist's purpose gets filled in. Drift clears.
  await setSystemField(org.id, 'underwriting-assist', {
    purpose: 'Flags applications that fall outside standard underwriting rules for manual review.',
  });
  r = await observeEstate(org.id, 'AIC continuity observer', null, daysAgo(9));
  console.log(`Day -9 observation: ${r?.eventsWritten ?? 0} events`);

  // ── Day -7: invoice-matching-bot is finally declared. This is the same arc
  //    the live demo runs in real time with claims-triage-agent - here it is
  //    already resolved, so the record shows both a live example on the day
  //    and a settled one in its own history.
  await findOrCreateSystem(org.id, {
    name: 'invoice-matching-bot',
    purpose: 'Matches supplier invoices to purchase orders and flags mismatches for finance to review.',
    division: 4,
    riskTier: 1,
    lifecycleStage: 'PRODUCTION',
    status: 'ACTIVE',
    isSandbox: false,
  });
  r = await observeEstate(org.id, 'AIC continuity observer', null, daysAgo(7));
  console.log(`Day -7 observation: ${r?.eventsWritten ?? 0} events`);

  await logDecisions(org.id, 'fraud-scoring-agent', 5, daysAgo(6), 6);
  await logDecisions(org.id, 'underwriting-assist', 4, daysAgo(6));
  await logDecisions(org.id, 'invoice-matching-bot', 6, daysAgo(6));

  // ── Day -4: AIC raises a finding.
  await getTenantDb(org.id).transaction(async (tx) => {
    await tx.insert(auditFindings).values({
      orgId: org.id,
      raisedBy: assessor.id,
      severity: 'MINOR',
      title: 'Bias-test evidence for fraud-scoring-agent is due for renewal',
      description:
        'The four-fifths-rule evidence on file for fraud-scoring-agent was last verified ' +
        'over 90 days ago. Not a finding against the system itself - a finding that its evidence needs refreshing.',
      status: 'OPEN',
      dueAt: daysAgo(-10), // 10 days from "now"
    });
  });
  r = await observeEstate(org.id, 'AIC continuity observer', null, daysAgo(4));
  console.log(`Day -4 observation: ${r?.eventsWritten ?? 0} events`);

  await logDecisions(org.id, 'fraud-scoring-agent', 3, daysAgo(2));
  await logDecisions(org.id, 'underwriting-assist', 3, daysAgo(2));
  await logDecisions(org.id, 'invoice-matching-bot', 4, daysAgo(2));

  // ── Day -1: customer-support-chatbot goes live. The most recent entry, so
  //    the continuity record has something dated yesterday, not just history.
  await setSystemField(org.id, 'customer-support-chatbot', {
    lifecycleStage: 'PRODUCTION',
    status: 'ACTIVE',
    isSandbox: false,
  });
  r = await observeEstate(org.id, 'AIC continuity observer', null, daysAgo(1));
  console.log(`Day -1 observation: ${r?.eventsWritten ?? 0} events`);

  // ── Bring the cursor up to "now" so nothing reads as stale the moment
  //    someone opens the dashboard on Friday.
  r = await observeEstate(org.id, 'AIC continuity observer', null, new Date());
  console.log(`Final observation (now): ${r?.eventsWritten ?? 0} events, ${r?.drift.length ?? 0} live drift condition(s)`);

  console.log('\nDone. Org id:', org.id, '- slug:', ORG_SLUG);
  console.log('policy-renewal-optimiser stays declared-but-silent on purpose (DRIFT-SILENT-PRODUCTION-SYSTEM).');
  console.log('"claims-triage-agent" was never touched - still yours to record live on Friday.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

/**
 * NOTE ON RUNNING THIS FOR REAL.
 *
 * apps/platform's Dockerfile only copies .next/standalone into the runner
 * image - no scripts/, no dev dependencies, no tsx. This cannot run inside
 * the deployed container. And DATABASE_URL's host (confirmed 15 Sep) is a
 * docker-internal hostname, not reachable from a laptop directly. The
 * practical way to run this for real: SSH to the VPS and tunnel the
 * Postgres port to your Mac -
 *
 *   ssh -L 5433:mkmg7hfxjnlixrozbuzswf7s:5432 root@69.62.120.171
 *
 * - then, in another terminal, from apps/platform/:
 *
 *   DATABASE_URL="postgres://<user>:<password>@localhost:5433/postgres" \
 *     npx tsx scripts/seed-demo-org.ts
 *
 * using the same Postgres credentials Coolify already has on the
 * postgresql-database-aic resource. Needs migrations 001 and 004 applied
 * first - this script reads/writes accountable_persons, aware_assessments-
 * adjacent tables and estate_events/estate_snapshots, none of which exist
 * until those run.
 */
