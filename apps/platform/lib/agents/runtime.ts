/**
 * The agent runtime against the database: starts runs, resumes them after a
 * person answers, and keeps the hash chain, the usage records and the limits.
 * The loop itself is in ./engine.
 */
import {
  getTenantDb, getSystemDb, agents, agentRuns, agentRunSteps, aiSystems, organizations, llmUsageRecords, EncryptionService,
  and, eq, gte, desc, sql,
} from '@aic/db';
import { recordDecisionWithLedger } from '@/lib/ledger';
import { findPrice, priced, costAt } from '@/lib/spend-switch';
import { cleanLimits, readinessProblems, type AgentProvider, type AgentTool } from './config';
import { advance, resume, stepHash, type AgentSnapshot, type EngineDeps, type RunRecord, type RunState, type StepKind } from './engine';

type AgentRow = typeof agents.$inferSelect;
type RunRow = typeof agentRuns.$inferSelect;

export class RunRefused extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const toRecord = (r: RunRow): RunRecord => ({
  id: r.id, status: r.status as RunRecord['status'], state: (r.state as RunState) ?? { messages: [], modelCalls: 0 },
  inputTokens: Number(r.inputTokens), outputTokens: Number(r.outputTokens), costUsd: Number(r.costUsd), output: r.output, error: r.error,
});

export function readToolSecrets(a: Pick<AgentRow, 'toolSecretsCiphertext'>): Record<string, Record<string, string>> {
  if (!a.toolSecretsCiphertext) return {};
  const plain = EncryptionService.decrypt(a.toolSecretsCiphertext);
  try { return JSON.parse(plain); } catch { return {}; }
}

async function snapshot(orgId: string, a: AgentRow): Promise<AgentSnapshot> {
  const [org] = await getSystemDb().select({ name: organizations.name }).from(organizations).where(eq(organizations.id, orgId)).limit(1);
  const apiKey = EncryptionService.decrypt(a.modelKeyCiphertext);
  if (!apiKey || apiKey === EncryptionService.UNREADABLE) throw new RunRefused(409, 'AIC cannot read this agent’s model key. Add it again on the agent’s page.');
  return {
    id: a.id, name: a.name, provider: a.provider as AgentProvider, model: a.model, instructions: a.instructions,
    tools: (a.tools as AgentTool[]) ?? [], limits: cleanLimits(a.limits), apiKey, toolSecrets: readToolSecrets(a), orgName: org?.name ?? 'your organisation',
  };
}

function depsFor(orgId: string, agent: AgentRow, runId: string, trigger: { via: 'session' | 'api_key'; userId: string | null }): EngineDeps {
  const db = getTenantDb(orgId);
  return {
    appendStep: async (kind: StepKind, name, detail, actorId = null) => {
      await db.query(async (tx) => {
        const [last] = await tx.select({ seq: agentRunSteps.seq, hash: agentRunSteps.hash }).from(agentRunSteps).where(eq(agentRunSteps.runId, runId)).orderBy(desc(agentRunSteps.seq)).limit(1);
        const seq = (last?.seq ?? 0) + 1;
        const prevHash = last?.hash ?? null;
        await tx.insert(agentRunSteps).values({ runId, orgId, seq, kind, name, detail, actorId, prevHash, hash: stepHash(prevHash, { seq, kind, name, detail }) });
      });
    },
    saveRun: async (r) => {
      const done = ['completed', 'failed', 'stopped', 'refused'].includes(r.status);
      await db.query((tx) => tx.update(agentRuns).set({
        status: r.status, state: r.state, steps: r.state.modelCalls, inputTokens: r.inputTokens, outputTokens: r.outputTokens,
        costUsd: r.costUsd.toFixed(6), output: r.output, error: r.error, ...(done ? { finishedAt: new Date() } : {}),
      }).where(and(eq(agentRuns.id, r.id), eq(agentRuns.orgId, orgId))));
    },
    agentIsActive: async () => {
      const [a] = await db.query((tx) => tx.select({ status: agents.status }).from(agents).where(eq(agents.id, agent.id)).limit(1));
      return a?.status === 'active';
    },
    priceOf: (model, i, o) => { const p = findPrice(model); return priced(p) ? costAt(p, i, o) : null; },
    recordUsage: async (model, i, o, cost) => {
      const now = new Date();
      // Attribute the usage to the declared system the agent is linked to, so
      // it is not reported as AI in use but not declared.
      const systemName = agent.aiSystemId
        ? (await db.query((tx) => tx.select({ name: aiSystems.name }).from(aiSystems).where(eq(aiSystems.id, agent.aiSystemId!)).limit(1)))[0]?.name ?? agent.name
        : agent.name;
      await db.query((tx) => tx.insert(llmUsageRecords).values({
        orgId, provider: agent.provider, model, systemName, periodStart: now, periodEnd: now, requests: 1,
        inputTokens: i, outputTokens: o, costUsd: cost === null ? null : cost.toFixed(4), source: 'aic_runtime', ingestedVia: trigger.via, submittedBy: trigger.userId,
      }));
    },
    recordDecision: async (d) => {
      let systemName = agent.name;
      if (agent.aiSystemId) {
        const [s] = await db.query((tx) => tx.select({ name: aiSystems.name }).from(aiSystems).where(eq(aiSystems.id, agent.aiSystemId!)).limit(1));
        if (s) systemName = s.name;
      }
      const rec = await recordDecisionWithLedger({ orgId, systemName, inputParams: { subject: d.subject, agent: agent.name, agentId: agent.id, runId }, outcome: d.outcome, explanation: d.explanation });
      return { id: (rec as { id: string }).id };
    },
  };
}

/** Checks the limits that apply before a run starts. Throws RunRefused. */
async function checkStart(orgId: string, a: AgentRow) {
  if (a.status !== 'active') throw new RunRefused(409, a.status === 'paused' ? 'This agent is paused. Switch it on to run it.' : 'Switch this agent on before running it.');
  const problems = readinessProblems({ instructions: a.instructions, modelKeyHint: a.modelKeyHint, ownerUserId: a.ownerUserId, tools: (a.tools as AgentTool[]) ?? [], aiSystemId: a.aiSystemId });
  if (problems.length) throw new RunRefused(409, problems[0]);
  const limits = cleanLimits(a.limits);
  const db = getTenantDb(orgId);
  const [{ n }] = await db.query((tx) => tx.select({ n: sql<number>`count(*)::int` }).from(agentRuns).where(and(eq(agentRuns.agentId, a.id), gte(agentRuns.startedAt, new Date(Date.now() - 86_400_000)))));
  if (n >= limits.maxRunsPerDay) throw new RunRefused(429, `This agent has used its ${limits.maxRunsPerDay} runs for the last 24 hours.`);
  if (limits.monthlyBudgetUsd !== null) {
    const start = new Date(); start.setUTCDate(1); start.setUTCHours(0, 0, 0, 0);
    const [{ spent }] = await db.query((tx) => tx.select({ spent: sql<string>`coalesce(sum(${agentRuns.costUsd}), 0)` }).from(agentRuns).where(and(eq(agentRuns.agentId, a.id), gte(agentRuns.startedAt, start))));
    if (Number(spent) >= limits.monthlyBudgetUsd) throw new RunRefused(429, `This agent has reached its budget of $${limits.monthlyBudgetUsd} for the month.`);
  }
}

export async function loadAgent(orgId: string, agentId: string): Promise<AgentRow | null> {
  const [a] = await getTenantDb(orgId).query((tx) => tx.select().from(agents).where(and(eq(agents.id, agentId), eq(agents.orgId, orgId))).limit(1));
  return a ?? null;
}

/** Starts a run and carries it as far as it goes without a person. */
export async function startRun(orgId: string, a: AgentRow, input: string, trigger: { via: 'session' | 'api_key'; userId: string | null }): Promise<RunRow> {
  await checkStart(orgId, a);
  const text = input.trim().slice(0, 20_000);
  if (!text) throw new RunRefused(400, 'Give the agent something to do.');
  const snap = await snapshot(orgId, a);
  const db = getTenantDb(orgId);
  const state: RunState = { messages: [{ role: 'user', text }], modelCalls: 0, pending: null };
  const [run] = await db.query((tx) => tx.insert(agentRuns).values({
    orgId, agentId: a.id, agentVersion: a.version, trigger: trigger.via === 'api_key' ? 'api' : 'person', triggeredBy: trigger.userId, input: text, state,
  }).returning());
  const deps = depsFor(orgId, a, run.id, trigger);
  await deps.appendStep('started', null, { input: text.slice(0, 4000), model: a.model, version: a.version, tools: snap.tools.map((t) => t.name) }, trigger.userId);
  await advance(snap, toRecord(run), deps);
  return (await getRun(orgId, run.id))!;
}

export async function getRun(orgId: string, runId: string): Promise<RunRow | null> {
  const [r] = await getTenantDb(orgId).query((tx) => tx.select().from(agentRuns).where(and(eq(agentRuns.id, runId), eq(agentRuns.orgId, orgId))).limit(1));
  return r ?? null;
}

export async function runSteps(orgId: string, runId: string) {
  return getTenantDb(orgId).query((tx) => tx.select().from(agentRunSteps).where(eq(agentRunSteps.runId, runId)).orderBy(agentRunSteps.seq));
}

/** A person approves, refuses or answers a waiting run, or stops any unfinished run. */
export async function actOnRun(
  orgId: string, a: AgentRow, run: RunRow, action: { kind: 'approve' } | { kind: 'deny'; reason?: string } | { kind: 'answer'; text: string } | { kind: 'stop' }, userId: string,
): Promise<RunRow> {
  const deps = depsFor(orgId, a, run.id, { via: 'session', userId });
  if (action.kind === 'stop') {
    if (!['running', 'waiting_for_person'].includes(run.status)) throw new RunRefused(409, 'This run has already finished.');
    const r = toRecord(run);
    r.status = 'stopped'; r.error = 'Stopped by a person.'; r.state = { ...r.state, pending: null };
    await deps.appendStep('stopped', null, { reason: r.error }, userId);
    await deps.saveRun(r);
    return (await getRun(orgId, run.id))!;
  }
  const snap = await snapshot(orgId, a);
  const out = await resume(snap, toRecord(run), action, userId, deps);
  if (!('id' in out)) throw new RunRefused(409, out.error);
  return (await getRun(orgId, run.id))!;
}
