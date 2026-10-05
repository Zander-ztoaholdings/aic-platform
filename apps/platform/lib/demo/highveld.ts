/**
 * Highveld Credit (Demo): the one demo company AIC shows prospects.
 *
 * Builds, or rebuilds from scratch, a fictional South African lender with
 * enough true-looking data that every screen in the demo script has one clear
 * thing to show (see the "AIC demo baseline" doc). Ground rules, enforced
 * here rather than remembered:
 *   - the name always carries "(Demo)", on the organisation, its legal name,
 *     its Trust page and its badge;
 *   - its people use addresses on demo.aiccertified.cloud, a domain AIC holds;
 *   - its badge is never listed in the public directory, and its Trust page
 *     starts switched off;
 *   - its connected systems are marked mode 'demo', so the nightly sync never
 *     tries to reach a real GitHub or Microsoft tenant for it;
 *   - nothing is copied from a real client.
 *
 * Every run deletes the demo organisation and everything under it, then
 * builds it again, so a demo can be reset in one click. The people are kept
 * (same ids and email addresses) and given a fresh password and authenticator
 * secret each run.
 */
import { createHash, randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import {
  getSystemDb, eq, inArray,
  organizations, users, accountablePersons, aiSystems, orgPolicies, policyVersions, policyAcceptances,
  integrations, integrationChecks, llmUsageRecords, decisionRecords, auditRequirements, auditDocuments,
  awareAssessments, awareBadges, trustPages, orgFrameworks, auditFindings, correctiveActions, auditLogs, auditLedger, inviteCodes, EncryptionService,
} from '@aic/db';
import { StorageService, storageConfig } from '@aic/db/storage';
import { MFAService } from '@aic/auth';
import { BUILDERS, type BuilderContext } from '../policy-builder';
import { TEMPLATE_BY_KEY } from '../policy-templates';
import { bodyHash } from '../policy-hash';
import { fetchPublishedStandard, requirementsForDivision } from '../standard';
import { fetchAwareInstrument } from '../aware/instrument';
import { generateBadgeCode, badgeExpiry } from '../aware/badge';
import { ACCOUNTABLE_PERSON_DECLARATION } from '../aware/declarations';
import { controlSlot } from '../common-controls';
import { observeEstate } from '../continuity-store';

export const DEMO_ORG_ID = 'de300000-0000-4000-8000-0000000000a1';
export const DEMO_DOMAIN = 'demo.aiccertified.cloud';
export const DEMO_TRUST_SLUG = 'highveld-credit-demo';

const ORG = {
  name: 'Highveld Credit (Demo)',
  legalName: 'Highveld Credit (Pty) Ltd (Demo)',
  sector: 'Financial services',
  sizeBand: '51-200',
};

const PEOPLE = [
  { key: 'naledi', name: 'Naledi Khumalo', jobTitle: 'Chief Operating Officer', role: 'ORG_ADMIN' as const },
  { key: 'pieter', name: 'Pieter van Wyk', jobTitle: 'Head of Credit', role: 'ORG_USER' as const },
  { key: 'sipho', name: 'Sipho Dlamini', jobTitle: 'Head of IT', role: 'ORG_ADMIN' as const },
  { key: 'ayesha', name: 'Ayesha Patel', jobTitle: 'Compliance Officer', role: 'ORG_USER' as const },
];
const ASSESSOR = { name: 'AIC Demo Assessor', email: `assessor@${DEMO_DOMAIN}` };

const SYSTEMS = [
  { id: 'de300000-0000-4000-8000-0000000000b1', name: 'Loan pre-screening', purpose: 'Scores each application: approve, refer or decline', riskTier: 1, stage: 'production' },
  { id: 'de300000-0000-4000-8000-0000000000b2', name: 'Collections prioritiser', purpose: 'Orders the overdue book for the collections team', riskTier: 2, stage: 'production' },
  { id: 'de300000-0000-4000-8000-0000000000b3', name: 'Customer help assistant', purpose: 'Answers customer questions in chat, built on a hosted language model', riskTier: 3, stage: 'production' },
  { id: 'de300000-0000-4000-8000-0000000000b4', name: 'Payslip fraud check', purpose: 'Flags edited payslips for a person to look at', riskTier: 2, stage: 'pilot' },
];

const DAY = 86_400_000;
/** Deterministic pseudo-random numbers, so every reset looks the same. */
function rng(seed: number) { let x = seed >>> 0; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32); }

export type DemoCredentials = { emails: string[]; password: string; totpSecret: string; otpauth: string };

/**
 * The demo organisation's own logs go with it. Its audit chains are per
 * organisation, so this cannot break any other organisation's chain; and a
 * fictional company's sign-in log is not a record anyone relies on.
 */
async function deleteDemoOrg() {
  const db = getSystemDb();
  await db.delete(auditLogs).where(eq(auditLogs.orgId, DEMO_ORG_ID));
  await db.delete(auditLedger).where(eq(auditLedger.orgId, DEMO_ORG_ID));
  await db.delete(inviteCodes).where(eq(inviteCodes.orgId, DEMO_ORG_ID));
  await db.delete(organizations).where(eq(organizations.id, DEMO_ORG_ID));
}

export async function seedHighveld(): Promise<{ credentials: DemoCredentials; summary: Record<string, number> }> {
  const db = getSystemDb();
  const now = new Date();
  const ago = (days: number, hours = 0) => new Date(now.getTime() - days * DAY - hours * 3_600_000);
  /** A working-hours moment, `days` ago, at hh:mm in Johannesburg (UTC+2), so the history reads like people did it. */
  const at = (days: number, hh: number, mm: number) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days, hh - 2, mm));
  const rand = rng(20261005);

  // ── 1. Clear the old demo, keeping its people ──────────────────────────────
  const emails = PEOPLE.map((p) => `${p.key}@${DEMO_DOMAIN}`);
  await db.update(users).set({ orgId: null }).where(inArray(users.email, emails));
  await deleteDemoOrg();

  // ── 2. The organisation ────────────────────────────────────────────────────
  await db.insert(organizations).values({
    id: DEMO_ORG_ID, name: ORG.name, legalName: ORG.legalName, slug: DEMO_TRUST_SLUG,
    division: 2, sector: ORG.sector, sizeBand: ORG.sizeBand, country: 'South Africa',
    website: `https://${DEMO_DOMAIN}`, contactEmail: `compliance@${DEMO_DOMAIN}`,
    certificationStatus: 'DRAFT', publicDirectoryVisible: false,
    affectsIndividuals: 'yes', solelyAutomated: 'some',
    signupCompletedAt: ago(62), createdAt: ago(62), aiMonthlyBudgetUsd: '2000',
  } as typeof organizations.$inferInsert);

  // ── 3. People: one password and one authenticator secret for all four ─────
  const password = `Demo-${randomBytes(6).toString('base64url')}-${randomBytes(3).toString('hex')}`;
  const totpSecret = MFAService.generateSecret();
  const storedSecret = EncryptionService.isConfigured() ? EncryptionService.encrypt(totpSecret) : totpSecret;
  const passwordHash = await bcrypt.hash(password, 12);
  const ids: Record<string, string> = {};
  for (const p of PEOPLE) {
    const email = `${p.key}@${DEMO_DOMAIN}`;
    const values = {
      email, name: p.name, jobTitle: p.jobTitle, role: p.role, orgId: DEMO_ORG_ID, passwordHash,
      isActive: true, emailVerified: true, isSuperAdmin: false, twoFactorEnabled: true, twoFactorSecret: storedSecret,
      isAccountablePerson: p.key === 'naledi', failedLoginAttempts: 0, lockoutUntil: null, updatedAt: now,
    };
    const [row] = await db.insert(users).values({ ...values, createdAt: ago(62) } as typeof users.$inferInsert)
      .onConflictDoUpdate({ target: users.email, set: values }).returning({ id: users.id });
    ids[p.key] = row.id;
  }
  const [assessor] = await db.insert(users).values({
    email: ASSESSOR.email, name: ASSESSOR.name, role: 'AIC_AUDITOR', passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 12),
    isActive: false, emailVerified: true,
  } as typeof users.$inferInsert).onConflictDoUpdate({ target: users.email, set: { isActive: false } }).returning({ id: users.id });

  // ── 4. AI systems and the accountable person, declared over two months ────
  // Each stage is observed at the date it happened, so the continuity record
  // reads as a history rather than ten entries stamped the minute this ran.
  const observe = async (at: Date, who: string) => {
    try { await observeEstate(DEMO_ORG_ID, who, null, at); } catch (e) { console.error('[DEMO] observation failed:', (e as Error).message); }
  };
  const declare = (s: (typeof SYSTEMS)[number], at: Date, overrides: Partial<{ riskTier: number; stage: string }> = {}) =>
    db.insert(aiSystems).values({
      id: s.id, orgId: DEMO_ORG_ID, name: s.name, purpose: s.purpose, riskTier: overrides.riskTier ?? s.riskTier, division: 2,
      lifecycleStage: overrides.stage ?? s.stage, status: 'active', isActive: true, isSandbox: false, createdAt: at, updatedAt: at,
    });
  await declare(SYSTEMS[0], ago(58));
  await declare(SYSTEMS[1], ago(58), { stage: 'pilot' });
  await observe(at(58, 9, 42), 'Naledi Khumalo');

  const [ap] = await db.insert(accountablePersons).values({
    orgId: DEMO_ORG_ID, nominatedBy: ids.naledi, name: 'Naledi Khumalo', jobTitle: 'Chief Operating Officer', email: `naledi@${DEMO_DOMAIN}`,
    declarationVersion: ACCOUNTABLE_PERSON_DECLARATION.version, declarationAcceptedAt: ago(55),
  }).returning({ id: accountablePersons.id });
  await observe(at(55, 14, 7), 'Naledi Khumalo');

  await declare(SYSTEMS[2], ago(41), { riskTier: 2 });
  await db.update(aiSystems).set({ lifecycleStage: 'production', updatedAt: ago(40) }).where(eq(aiSystems.id, SYSTEMS[1].id));
  await observe(at(40, 11, 18), 'Sipho Dlamini');

  await db.update(aiSystems).set({ riskTier: 3, updatedAt: ago(27) }).where(eq(aiSystems.id, SYSTEMS[2].id));
  await observe(at(27, 16, 31), 'Naledi Khumalo');

  await declare(SYSTEMS[3], ago(20));
  await observe(at(20, 10, 3), 'Pieter van Wyk');

  // ── 5. Policies, written by the policy builder from Highveld's answers ─────
  const ctx: BuilderContext = {
    orgName: ORG.legalName,
    people: PEOPLE.map((p) => ({ name: p.name, jobTitle: p.jobTitle })),
    accountable: { name: 'Naledi Khumalo', jobTitle: 'Chief Operating Officer' },
    connected: ['GitHub', 'Microsoft 365', 'OpenAI', 'Anthropic'],
    contactEmail: `security@${DEMO_DOMAIN}`,
  };
  const policyPlan: { key: string; extra?: Record<string, string>; versions: number; accepted: string[] }[] = [
    { key: 'ai-acceptable-use', versions: 2, accepted: ['naledi', 'pieter', 'sipho', 'ayesha'] },
    { key: 'human-oversight', versions: 1, accepted: ['naledi', 'pieter', 'sipho'] },
    { key: 'information-security', extra: { vault: '1Password' }, versions: 1, accepted: ['naledi', 'pieter', 'sipho', 'ayesha'] },
    { key: 'incident-response', versions: 0, accepted: [] },
  ];
  for (const p of policyPlan) {
    const b = BUILDERS[p.key];
    const t = TEMPLATE_BY_KEY[p.key];
    const body = b.render({ ...b.defaults(ctx), ...(p.extra ?? {}) }, ctx);
    const [pol] = await db.insert(orgPolicies).values({
      orgId: DEMO_ORG_ID, templateKey: p.key, title: t.title, body, publishedVersion: p.versions, ownerId: ids.naledi,
      reviewDueAt: new Date(now.getTime() + 300 * DAY), createdAt: ago(50), updatedAt: ago(14),
    }).returning({ id: orgPolicies.id });
    for (let v = 1; v <= p.versions; v++) {
      const vBody = v < p.versions ? body.replace('## Breaches', '## Reporting problems') : body;
      await db.insert(policyVersions).values({
        orgId: DEMO_ORG_ID, policyId: pol.id, version: v, title: t.title, body: vBody, bodyHash: bodyHash(t.title, vBody),
        publishedAt: ago(v < p.versions ? 45 : 21), publishedBy: ids.naledi,
      });
    }
    if (p.versions) {
      await db.insert(policyAcceptances).values(p.accepted.map((k, i) => ({
        orgId: DEMO_ORG_ID, policyId: pol.id, version: p.versions, userId: ids[k], acceptedAt: ago(20 - i),
      })));
    }
  }

  // ── 6. Connected systems and what their checks show ────────────────────────
  const conn = async (provider: string, label: string, externalId: string | null, settings: Record<string, unknown>) => {
    const [r] = await db.insert(integrations).values({
      orgId: DEMO_ORG_ID, provider, mode: 'demo', status: 'active', externalId, accountLabel: label, settings,
      lastSyncedAt: ago(0, 3), connectedBy: ids.sipho, createdAt: ago(40), updatedAt: ago(0, 3),
    }).returning({ id: integrations.id });
    return r.id;
  };
  const gh = await conn('github', 'highveld-credit', 'demo', { accountType: 'Organization', repositories: ['highveld-credit/credit-engine', 'highveld-credit/website'], repositoriesTotal: 2, repositorySelection: 'selected', links: { 'highveld-credit/credit-engine': SYSTEMS[0].id, 'highveld-credit/website': 'none' } });
  const ms = await conn('microsoft', 'Microsoft 365', 'demo-tenant', { tenantName: 'Highveld Credit (Demo)', users: 45 });
  const oa = await conn('openai', 'OpenAI', null, { links: { 'gpt-4o': SYSTEMS[2].id } });
  const an = await conn('anthropic', 'Anthropic', null, { links: { 'claude-sonnet-4-5': SYSTEMS[3].id } });
  const failSince = ago(9);
  const check = (integrationId: string, checkKey: string, subject: string, status: string, summary: string, detail?: Record<string, unknown>) => ({
    orgId: DEMO_ORG_ID, integrationId, checkKey, subject, status, summary, detail: detail ?? {},
    failingSince: status === 'fail' ? failSince : null, observedAt: ago(0, 3),
  });
  await db.insert(integrationChecks).values([
    check(gh, 'github.branch_protected', 'highveld-credit/credit-engine', 'pass', 'main is protected.'),
    check(gh, 'github.review_required', 'highveld-credit/credit-engine', 'pass', 'main needs 1 approving review before a merge.'),
    check(gh, 'github.merged_with_review', 'highveld-credit/credit-engine', 'pass', '19 of the last 20 merged changes were approved by someone other than their author.'),
    check(gh, 'github.ai_changes_reviewed', 'highveld-credit/credit-engine', 'fail', '1 AI-written change was merged without a human approval: #214 "Copilot: tune affordability thresholds".', { pulls: [{ number: 214, title: 'Copilot: tune affordability thresholds', author: 'Copilot' }] }),
    check(gh, 'github.no_critical_vulnerabilities', 'highveld-credit/credit-engine', 'pass', 'No open critical or high alerts.'),
    check(gh, 'github.no_exposed_secrets', 'highveld-credit/credit-engine', 'pass', 'No open secret-scanning alerts.'),
    check(gh, 'github.ai_usage_declared', 'highveld-credit/credit-engine', 'pass', 'Uses the OpenAI SDK; linked to Loan pre-screening.'),
    check(gh, 'github.branch_protected', 'highveld-credit/website', 'pass', 'main is protected.'),
    check(gh, 'github.review_required', 'highveld-credit/website', 'pass', 'main needs 1 approving review before a merge.'),
    check(gh, 'github.merged_with_review', 'highveld-credit/website', 'pass', 'All of the last 12 merged changes were reviewed.'),
    check(gh, 'github.no_critical_vulnerabilities', 'highveld-credit/website', 'pass', 'No open critical or high alerts.'),
    check(gh, 'github.no_exposed_secrets', 'highveld-credit/website', 'pass', 'No open secret-scanning alerts.'),
    check(gh, 'github.org_2fa_required', 'highveld-credit', 'pass', 'Two-factor sign-in is required for every member.'),
    check(ms, 'm365.mfa_enforced', 'Highveld Credit (Demo)', 'fail', 'Security defaults are off and no Conditional Access policy requires MFA for all users.'),
    check(ms, 'm365.mfa_registered', 'Highveld Credit (Demo)', 'fail', '4 of 45 members have no second factor registered, 1 of them an administrator.'),
    check(ms, 'm365.global_admins', 'Highveld Credit (Demo)', 'pass', '3 global administrators.'),
    check(ms, 'm365.stale_accounts', 'Highveld Credit (Demo)', 'fail', '2 enabled accounts have not signed in for over 90 days.'),
    check(oa, 'ai.usage_fresh', 'openai', 'pass', 'OpenAI usage reached AIC within the last day.'),
    check(oa, 'ai.models_declared', 'openai', 'fail', 'gpt-4.1 is in use but not linked to any declared system.', { models: ['gpt-4.1'] }),
    check(an, 'ai.usage_fresh', 'anthropic', 'pass', 'Anthropic usage reached AIC within the last day.'),
    check(an, 'ai.models_declared', 'anthropic', 'pass', 'Every model in use is linked to a declared system.'),
  ]);
  await observe(at(9, 2, 15), 'AIC connector sync');

  // ── 7. AI usage: 45 days, three models, one with no owner ──────────────────
  const usage: (typeof llmUsageRecords.$inferInsert)[] = [];
  const models = [
    { provider: 'openai', model: 'gpt-4o', system: 'Customer help assistant', perDay: 34, tokIn: 2_400_000, tokOut: 2_600_000, req: 5200 },
    { provider: 'anthropic', model: 'claude-sonnet-4-5', system: 'Payslip fraud check', perDay: 22, tokIn: 1_100_000, tokOut: 540_000, req: 900 },
    { provider: 'openai', model: 'gpt-4.1', system: null, perDay: 17, tokIn: 3_900_000, tokOut: 60_000, req: 7800 },
  ];
  for (let d = 45; d >= 1; d--) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - d));
    const end = new Date(start.getTime() + DAY);
    for (const m of models) {
      const f = 0.8 + rand() * 0.45;
      usage.push({
        orgId: DEMO_ORG_ID, provider: m.provider, model: m.model, systemName: m.system, periodStart: start, periodEnd: end,
        requests: Math.round(m.req * f), inputTokens: Math.round(m.tokIn * f), outputTokens: Math.round(m.tokOut * f),
        costUsd: (m.perDay * f).toFixed(2), source: 'api_pull', ingestedVia: 'aic_pull',
      });
    }
  }
  await db.insert(llmUsageRecords).values(usage);

  // ── 8. Decisions: 90 days, two systems, about 3% overridden, three held ────
  const reasons = ['Information the system did not have', 'Error in the data the system used', "The customer's circumstances", 'Policy exception approved'];
  const decisions: (typeof decisionRecords.$inferInsert)[] = [];
  const hash = (o: unknown) => createHash('sha256').update(JSON.stringify(o)).digest('hex');
  for (let d = 90; d >= 0; d--) {
    const n = Math.round(130 + rand() * 20);
    for (let i = 0; i < n; i++) {
      const loan = rand() < 0.72;
      const at = new Date(ago(d).getTime() - Math.floor(rand() * DAY * 0.9));
      if (at > now) continue;
      const ref = `${loan ? 'APP' : 'COL'}-${String(100000 + decisions.length).slice(1)}`;
      const r = rand();
      const outcome = loan ? { decision: r < 0.58 ? 'approve' : r < 0.8 ? 'refer' : 'decline', score: Math.round(300 + rand() * 450) } : { decision: r < 0.3 ? 'call first' : r < 0.75 ? 'sms reminder' : 'hold', priority: Math.ceil(rand() * 5) };
      const input = loan ? { application: ref, amount_zar: Math.round(2000 + rand() * 48000), term_months: [6, 12, 24, 36][Math.floor(rand() * 4)] } : { account: ref, days_overdue: Math.round(5 + rand() * 120) };
      const system = loan ? 'Loan pre-screening' : 'Collections prioritiser';
      const override = rand() < 0.031;
      const final = override ? (loan ? { decision: outcome.decision === 'decline' ? 'approve' : 'decline' } : { decision: 'hold' }) : null;
      decisions.push({
        orgId: DEMO_ORG_ID, systemName: system, inputParams: input, outcome, externalRef: ref,
        explanation: loan ? `Affordability score ${(outcome as { score: number }).score}.` : null,
        integrityHash: hash({ orgId: DEMO_ORG_ID, systemName: system, inputParams: input, outcome }),
        isHumanOverride: override, overrideReason: override ? reasons[Math.floor(rand() * reasons.length)] : null,
        overriddenBy: override ? ids.pieter : null,
        reviewStatus: override ? 'overridden' : 'not_required', reviewedBy: override ? ids.pieter : null,
        reviewedAt: override ? new Date(at.getTime() + 3_600_000) : null, finalOutcome: final, createdAt: at,
      });
    }
  }
  for (let i = 0; i < 3; i++) {
    const input = { application: `APP-9${4410 + i}`, amount_zar: [18500, 32000, 7400][i], term_months: [24, 36, 12][i] };
    const outcome = { decision: 'decline', score: [412, 388, 455][i] };
    decisions.push({
      orgId: DEMO_ORG_ID, systemName: 'Loan pre-screening', inputParams: input, outcome, externalRef: input.application,
      explanation: ['Affordability below threshold after declared expenses.', 'Two accounts in arrears at the bureau.', 'Income could not be verified from the payslip.'][i],
      integrityHash: hash({ orgId: DEMO_ORG_ID, systemName: 'Loan pre-screening', inputParams: input, outcome }),
      reviewStatus: 'pending', reviewDueAt: new Date(now.getTime() + (30 + i * 4) * 3_600_000), createdAt: ago(0, 2 + i),
    });
  }
  for (let i = 0; i < decisions.length; i += 1000) await db.insert(decisionRecords).values(decisions.slice(i, i + 1000));

  // ── 9. Evidence Vault: 14 accepted, 3 waiting, 1 sent back ─────────────────
  const standard = await fetchPublishedStandard();
  const reqs = requirementsForDivision(standard, 2);
  const reqRows = await db.insert(auditRequirements).values(reqs.map((r) => ({
    orgId: DEMO_ORG_ID, code: r.code, rightCode: r.right, category: r.right, title: r.text,
    evidenceGuidance: r.evidence, standardVersion: standard.version, status: 'PENDING',
  }))).returning({ id: auditRequirements.id, code: auditRequirements.code, title: auditRequirements.title });
  await db.update(organizations).set({ standardVersion: standard.version }).where(eq(organizations.id, DEMO_ORG_ID));

  const canStore = !!storageConfig();
  let stored = 0;
  const file = async (name: string, text: string) => {
    if (!canStore) return { url: `demo-unstored/${name}`, hash: createHash('sha256').update(text).digest('hex') };
    try {
      const { evidenceId, hash: h } = await StorageService.saveEvidence(DEMO_ORG_ID, name, Buffer.from(text), 'text/plain');
      stored++;
      return { url: evidenceId, hash: h };
    } catch (e) {
      // Storage down: the record still shows the file; only downloading it fails.
      console.error('[DEMO] evidence file not stored:', (e as Error).message);
      return { url: `demo-unstored/${name}`, hash: createHash('sha256').update(text).digest('hex') };
    }
  };
  const doc = async (opts: { requirementId?: string | null; slot: string; title: string; outcome: 'ACCEPTED' | 'INSUFFICIENT' | null; notes?: string; days: number; triage?: object }) => {
    const f = await file(opts.title, `${opts.title}\n\nDemo evidence for ${ORG.name}. Fictional; not a real document.\n`);
    await db.insert(auditDocuments).values({
      orgId: DEMO_ORG_ID, requirementId: opts.requirementId ?? null, slotType: opts.slot, title: opts.title, fileUrl: f.url, fileChecksum: f.hash,
      fileSize: '1.2 KB', uploadedBy: ids.ayesha, status: opts.outcome === 'ACCEPTED' ? 'VERIFIED' : opts.outcome ? 'REJECTED' : 'UPLOADED',
      verificationOutcome: opts.outcome, verificationNotes: opts.notes ?? null,
      verifiedBy: opts.outcome ? assessor.id : null, verifiedAt: opts.outcome ? ago(opts.days - 2) : null,
      aiTriageNotes: opts.triage ? JSON.stringify(opts.triage) : null, createdAt: ago(opts.days),
    } as typeof auditDocuments.$inferInsert);
  };
  // A believable spread: the accountability and correction basics in, the
  // harder explanation and bias work still to come.
  const ACCEPTED = ['HU-1', 'HU-2', 'HU-3', 'HU-4', 'HU-6', 'CO-1', 'CO-2', 'CO-5', 'CO-9', 'TR-1', 'TR-2', 'EX-1', 'EX-7', 'EM-6'];
  const WAITING = ['HU-5', 'EX-3', 'TR-7'];
  const SENT_BACK = 'EM-7';
  const byCode = new Map(reqRows.map((r) => [r.code ?? '', r]));
  let k = 0;
  for (const code of ACCEPTED) { const r = byCode.get(code); if (r) await doc({ requirementId: r.id, slot: 'REQUIREMENT', title: `${code} evidence pack.pdf`, outcome: 'ACCEPTED', days: 44 - k++ * 2 }); }
  k = 0;
  for (const code of WAITING) { const r = byCode.get(code); if (r) await doc({ requirementId: r.id, slot: 'REQUIREMENT', title: `${code} evidence.pdf`, outcome: null, days: 3 - k++ }); }
  const sentBack = byCode.get(SENT_BACK);
  if (sentBack) await doc({ requirementId: sentBack.id, slot: 'REQUIREMENT', title: `${SENT_BACK} bias test summary.pdf`, outcome: 'INSUFFICIENT', days: 12, notes: 'This reports the overall approval rate but not the ratio between groups. File the disparate impact ratio for each protected characteristic you tested, with the period and sample size.' });

  // Two findings: one open and due soon, one closed with the response accepted.
  await db.insert(auditFindings).values({
    orgId: DEMO_ORG_ID, requirementId: sentBack?.id ?? null, raisedBy: assessor.id, severity: 'MINOR',
    title: 'Bias testing does not show the ratio between groups',
    description: 'The bias test summary filed for EM-7 reports overall approval rates only. The standard asks for the disparate impact ratio across each tested characteristic, and evidence that a ratio below 0.8 is investigated.',
    status: 'OPEN', raisedAt: ago(11), dueAt: new Date(now.getTime() + 10 * DAY), createdAt: ago(11), updatedAt: ago(11),
  });
  const hu4 = byCode.get('HU-4');
  const [closed] = await db.insert(auditFindings).values({
    orgId: DEMO_ORG_ID, requirementId: hu4?.id ?? null, raisedBy: assessor.id, severity: 'OBSERVATION',
    title: 'Override procedure did not name who may override',
    description: 'The written override procedure describes how to override a decision but not which roles may do so. Name the roles, so a reviewer can show they were entitled to make the change.',
    status: 'CLOSED', raisedAt: ago(38), dueAt: ago(24), closedAt: ago(26), closedBy: assessor.id,
    closureNotes: 'Version 2 of the procedure names the credit team leads and the Head of Credit. Closed.', createdAt: ago(38), updatedAt: ago(26),
  }).returning({ id: auditFindings.id });
  await db.insert(correctiveActions).values({
    findingId: closed.id, orgId: DEMO_ORG_ID, rootCause: 'The procedure was written before the credit team was split into two shifts.',
    actionTaken: 'Updated the override procedure to name the roles allowed to override (credit team leads and the Head of Credit) and filed version 2.',
    submittedBy: ids.pieter, submittedAt: ago(30), reviewedBy: assessor.id, reviewedAt: ago(26), outcome: 'ACCEPTED',
    reviewNotes: 'Roles are now named and match the people recorded as overriding in the decision log.',
  });
  await doc({ slot: controlSlot('ops.backup'), title: 'Backup schedule and restore test, August 2026.pdf', outcome: 'ACCEPTED', days: 30 });
  await doc({ slot: controlSlot('ops.encryption'), title: 'Database encryption settings.pdf', outcome: null, days: 1, triage: {
    verdict: 'partly', summary: 'Screenshots of encryption-at-rest settings for the production database.', missing: ['Nothing on encryption in transit', 'No date or owner on the document'],
    documentDate: null, model: 'demo', at: ago(1).toISOString(),
  } });

  // ── 10. AIC Aware: declared by Naledi, badge current, never listed ─────────
  const instrument = await fetchAwareInstrument();
  const answers = Object.fromEntries(instrument.questions.map((q) => [q.id, Math.max(...q.options.map((o) => o.value))]));
  const [assessment] = await db.insert(awareAssessments).values({
    orgId: DEMO_ORG_ID, userId: ids.naledi, answers, status: 'SUBMITTED', questionSetVersion: instrument.version,
    startedAt: ago(36), updatedAt: ago(35), submittedAt: ago(35), attestedAt: ago(35), attestedBy: ids.naledi,
  }).returning({ id: awareAssessments.id });
  await db.insert(awareBadges).values({
    code: generateBadgeCode(), orgId: DEMO_ORG_ID, assessmentId: assessment.id, accountablePersonId: ap.id, issuedBy: ids.naledi,
    orgNameAtIssue: ORG.name, questionSetVersion: instrument.version, listed: false, issuedAt: ago(35), expiresAt: badgeExpiry(ago(35)),
  });

  // ── 11. Trust page (off until a demo), frameworks tracked ──────────────────
  await db.insert(trustPages).values({
    orgId: DEMO_ORG_ID, slug: DEMO_TRUST_SLUG, enabled: false, contactEmail: `trust@${DEMO_DOMAIN}`,
    intro: 'Highveld Credit (Demo) is a fictional lender used to demonstrate AIC. Nothing on this page describes a real company.',
    sections: { badge: true, certificate: true, accountable_person: true, policies: true, frameworks: true, monitoring: true, systems: false },
    updatedBy: ids.naledi,
  });
  try {
    await db.insert(orgFrameworks).values(['aic', 'popia', 'iso42001', 'eu_ai_act', 'iso27001'].map((k) => ({ orgId: DEMO_ORG_ID, frameworkKey: k, addedBy: ids.naledi })));
  } catch { /* migration 015 not applied: Controls shows the same defaults */ }

  // ── 12. Today's observation: anything the decisions and usage changed ──────
  await observe(ago(0, 1), 'AIC connector sync');

  return {
    credentials: { emails, password, totpSecret, otpauth: MFAService.getOTPAuthURI(totpSecret, 'Highveld Credit (Demo)', 'AIC Platform') },
    summary: { people: PEOPLE.length, systems: SYSTEMS.length, decisions: decisions.length, heldDecisions: 3, requirements: reqRows.length, usageRows: usage.length, filesStored: stored },
  };
}

/** Removes the demo organisation and switches its people off. */
export async function removeHighveld(): Promise<void> {
  const db = getSystemDb();
  const emails = PEOPLE.map((p) => `${p.key}@${DEMO_DOMAIN}`);
  await db.update(users).set({ orgId: null, isActive: false }).where(inArray(users.email, emails));
  await deleteDemoOrg();
}
