/**
 * The client set-up guide: the steps from an empty workspace to one an
 * assessor can work with, and whether each is done, read from the record.
 *
 * A step is done because the data says so (a system declared, a policy
 * published), never because someone pressed "done". Steps for admins only
 * are hidden from members. Agents are not a step: they are an optional tool
 * and have no bearing on certification.
 */
import {
  getTenantDb, aiSystems, accountablePersons, orgFrameworks, integrations, decisionRecords, orgPolicies,
  auditDocuments, suppliers, risks, users, awareBadges, and, eq, gt, isNull, sql,
} from '@aic/db';

export type SetupStepId =
  | 'accountable' | 'system' | 'frameworks' | 'connect' | 'decisions' | 'policy' | 'evidence' | 'suppliers' | 'risks' | 'team' | 'aware';

export type SetupStep = {
  id: SetupStepId;
  title: string;
  why: string;
  /** What to do on the page, shown in the guide while you are there. */
  how: string;
  href: string;
  /** data-tour anchors to highlight on that page, first found wins. */
  targets: string[];
  adminOnly?: boolean;
  minutes: number;
};

export const SETUP_STEPS: SetupStep[] = [
  {
    id: 'accountable', title: 'Name your accountable person', href: '/overview', targets: ['setup-accountable'], minutes: 2,
    why: 'Every AIC record starts with the person who answers for your automated decisions.',
    how: 'Add the person who answers for AI decisions in your organisation, usually an executive. They confirm by email.',
    adminOnly: true,
  },
  {
    id: 'system', title: 'Declare your first AI system', href: '/overview', targets: ['setup-declare'], minutes: 3,
    why: 'Your AI estate is the list everything else hangs off: decisions, evidence, risks and spend.',
    how: 'Declare a system that makes or shapes decisions about people. Say what it decides, about whom, and its Division.',
  },
  {
    id: 'frameworks', title: 'Choose your frameworks', href: '/frameworks', targets: ['setup-frameworks'], minutes: 2,
    why: 'AIC maps one set of evidence to every framework you track, so you only collect it once.',
    how: 'Tick the frameworks you are asked about (SOC 2, ISO 27001, POPIA and others). You can change this later.',
  },
  {
    id: 'connect', title: 'Connect a system AIC can read', href: '/integrations', targets: ['setup-connect'], minutes: 5,
    why: 'Connected systems give you evidence that keeps itself current, and show AI in use that nobody declared.',
    how: 'Start with your AI provider (OpenAI, Anthropic) or GitHub. Every connection is read-only and can be removed at any time.',
  },
  {
    id: 'decisions', title: 'Log your first decision', href: '/settings/keys', targets: ['setup-keys'], minutes: 10, adminOnly: true,
    why: 'The decision log is how you show a person can see, question and override what the AI decided.',
    how: 'Create an API key, and have your system send each decision to AIC with it. The page shows the exact request.',
  },
  {
    id: 'policy', title: 'Publish a policy', href: '/policies', targets: ['setup-policy'], minutes: 10,
    why: 'Policies say what you promise; AIC then checks your systems against them.',
    how: 'Start from a template, adjust it to how you actually work, and publish it. Your team accepts it in AIC.',
  },
  {
    id: 'evidence', title: 'File your first evidence', href: '/evidence', targets: ['setup-evidence', 'setup-evidence-empty'], minutes: 5,
    why: 'Evidence is what an assessor reviews. Each requirement shows what counts.',
    how: 'Open a requirement for your Division and upload what you already have.',
  },
  {
    id: 'suppliers', title: 'Start your supplier register', href: '/suppliers', targets: ['page-action'], minutes: 5,
    why: 'Your AI providers and anyone holding your data are suppliers POPIA expects you to check.',
    how: 'Add your AI providers and cloud host. AIC suggests the ones it can see from your connected systems.',
  },
  {
    id: 'risks', title: 'Record your first risks', href: '/risks', targets: ['page-action'], minutes: 5,
    why: 'A risk register with owners is one of the first things any assessor asks for.',
    how: 'Add what could go wrong with your AI systems, how likely and how bad, and who owns it.',
  },
  {
    id: 'team', title: 'Invite a colleague', href: '/settings', targets: ['setup-invite'], minutes: 1, adminOnly: true,
    why: 'Evidence usually sits with more than one person.',
    how: 'Invite whoever holds the evidence: IT, compliance, or the owner of an AI system.',
  },
  {
    id: 'aware', title: 'Take AIC Aware', href: '/aware', targets: ['setup-aware'], minutes: 10,
    why: 'A free self-declaration that ends with a badge anyone can verify. It is not certification.',
    how: 'Answer the questions honestly; the badge says what you declared, not more.',
  },
];

export type SetupProgress = { steps: (SetupStep & { done: boolean })[]; done: number; total: number; next: SetupStepId | null };

/** Pure: which steps a person sees, and the next one not done. */
export function progressFrom(done: Partial<Record<SetupStepId, boolean>>, isAdmin: boolean, skipped: string[] = []): SetupProgress {
  const steps = SETUP_STEPS.filter((s) => !s.adminOnly || isAdmin).map((s) => ({ ...s, done: !!done[s.id] }));
  const next = steps.find((s) => !s.done && !skipped.includes(s.id)) ?? steps.find((s) => !s.done) ?? null;
  return { steps, done: steps.filter((s) => s.done).length, total: steps.length, next: next?.id ?? null };
}

const n = (v: unknown) => Number(v ?? 0);

/** What the record says is done. Each count tolerates its table not existing yet. */
export async function setupDone(orgId: string): Promise<Partial<Record<SetupStepId, boolean>>> {
  const db = getTenantDb(orgId);
  const count = async (q: () => Promise<{ n: number }[]>) => { try { return n((await q())[0]?.n); } catch { return 0; } };
  const c = sql<number>`count(*)::int`;
  const [accountable, system, frameworks, connect, decisions, policy, evidence, sup, rsk, team, aware] = await Promise.all([
    count(() => db.query((tx) => tx.select({ n: c }).from(accountablePersons).where(and(eq(accountablePersons.orgId, orgId), isNull(accountablePersons.supersededAt))))),
    count(() => db.query((tx) => tx.select({ n: c }).from(aiSystems).where(eq(aiSystems.orgId, orgId)))),
    count(() => db.query((tx) => tx.select({ n: c }).from(orgFrameworks).where(eq(orgFrameworks.orgId, orgId)))),
    count(() => db.query((tx) => tx.select({ n: c }).from(integrations).where(eq(integrations.orgId, orgId)))),
    count(() => db.query((tx) => tx.select({ n: c }).from(decisionRecords).where(eq(decisionRecords.orgId, orgId)))),
    count(() => db.query((tx) => tx.select({ n: c }).from(orgPolicies).where(and(eq(orgPolicies.orgId, orgId), gt(orgPolicies.publishedVersion, 0))))),
    count(() => db.query((tx) => tx.select({ n: c }).from(auditDocuments).where(eq(auditDocuments.orgId, orgId)))),
    count(() => db.query((tx) => tx.select({ n: c }).from(suppliers).where(eq(suppliers.orgId, orgId)))),
    count(() => db.query((tx) => tx.select({ n: c }).from(risks).where(eq(risks.orgId, orgId)))),
    count(() => db.query((tx) => tx.select({ n: c }).from(users).where(eq(users.orgId, orgId)))),
    count(() => db.query((tx) => tx.select({ n: c }).from(awareBadges).where(eq(awareBadges.orgId, orgId)))),
  ]);
  return {
    accountable: accountable > 0, system: system > 0, frameworks: frameworks > 0, connect: connect > 0,
    decisions: decisions > 0,
    policy: policy > 0, evidence: evidence > 0, suppliers: sup > 0, risks: rsk > 0, team: team > 1, aware: aware > 0,
  };
}
