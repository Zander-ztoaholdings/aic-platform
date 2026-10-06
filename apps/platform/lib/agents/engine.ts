/**
 * The agent loop, independent of the database so it can be tested.
 *
 * Every step is appended to the run's hash chain before anything else
 * happens. A tool call is checked against the tool's scope by AIC (never by
 * the model); a call that needs a person pauses the run until someone
 * approves or refuses it in AIC. The kill switch (pausing the agent) is read
 * before every model call and every outside call.
 */
import { createHash } from 'crypto';
import { checkHttpCall, modelToolSpecs, type AgentLimits, type AgentProvider, type AgentTool, type HttpTool } from './config';
import { callModel, ModelError, type Msg, type ToolCall } from './models';
import { isPrivateHost } from '../connectors/http';
import { checkSharePointCall, type SharePointTool, type SpOp } from './sharepoint-scope';

export type StepKind =
  | 'started' | 'model' | 'tool_call' | 'tool_result' | 'refused' | 'approval_requested' | 'approved' | 'denied'
  | 'question' | 'answer' | 'decision_recorded' | 'finished' | 'failed' | 'stopped';

export type Pending =
  | { kind: 'approval'; call: ToolCall; url: string; method: string; body?: unknown }
  | { kind: 'question'; call: ToolCall; question: string };

export type RunState = { messages: Msg[]; pending?: Pending | null; modelCalls: number };

export type RunStatus = 'running' | 'waiting_for_person' | 'completed' | 'failed' | 'stopped' | 'refused';

export type RunRecord = {
  id: string; status: RunStatus; state: RunState; inputTokens: number; outputTokens: number; costUsd: number; output: string | null; error: string | null;
};

export type AgentSnapshot = {
  id: string; name: string; provider: AgentProvider; model: string; instructions: string; tools: AgentTool[]; limits: AgentLimits;
  apiKey: string; toolSecrets: Record<string, Record<string, string>>; orgName: string;
};

export type EngineDeps = {
  /** Appends one step to the run's chain. */
  appendStep: (kind: StepKind, name: string | null, detail: Record<string, unknown>, actorId?: string | null) => Promise<void>;
  saveRun: (r: RunRecord) => Promise<void>;
  /** Re-read on each turn: the kill switch. */
  agentIsActive: () => Promise<boolean>;
  priceOf: (model: string, inputTokens: number, outputTokens: number) => number | null;
  recordUsage: (model: string, inputTokens: number, outputTokens: number, costUsd: number | null) => Promise<void>;
  recordDecision: (d: { subject: string | null; outcome: string; explanation: string }) => Promise<{ id: string }>;
  /** Runs an already-checked SharePoint operation (lib/agents/sharepoint.ts). */
  sharePoint?: (tool: SharePointTool, call: SpOp) => Promise<{ ok: boolean; content: string }>;
  fetch?: typeof fetch;
};

export const HTTP_TIMEOUT_MS = 20_000;
export const MAX_RESULT_CHARS = 8_000;
const MAX_TOKENS_PER_CALL = 4_096;

/** sha256 over the previous hash and this step. */
export function stepHash(prevHash: string | null, s: { seq: number; kind: string; name: string | null; detail: unknown }): string {
  return createHash('sha256').update(`${prevHash ?? ''}|${s.seq}|${s.kind}|${s.name ?? ''}|${canonical(s.detail)}`).digest('hex');
}

/**
 * JSON with keys sorted and undefined dropped, so a step hashes the same
 * after a round trip through Postgres jsonb (which reorders keys).
 */
export function canonical(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map((x) => (x === undefined ? 'null' : canonical(x))).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`;
}

/** True when every step's hash follows from the one before. */
export function verifyChain(steps: { seq: number; kind: string; name: string | null; detail: unknown; prevHash: string | null; hash: string }[]): boolean {
  let prev: string | null = null;
  for (const s of [...steps].sort((a, b) => a.seq - b.seq)) {
    if (s.prevHash !== prev || stepHash(prev, s) !== s.hash) return false;
    prev = s.hash;
  }
  return true;
}

export function systemPrompt(a: Pick<AgentSnapshot, 'instructions' | 'orgName' | 'name'>): string {
  return `${a.instructions.trim()}

You are ${a.name}, an agent run for ${a.orgName} by AIC's agent runtime. Your tools reach only what they were set up for; a call outside that is refused, and some calls wait for a person to approve them. If a call is refused, do not try to get around it: explain what you needed instead. Never put personal details in a tool path or query when a reference will do.`;
}

const truncate = (s: string, n = MAX_RESULT_CHARS) => (s.length > n ? `${s.slice(0, n)}\n[cut off at ${n} characters]` : s);

/** Makes an approved, in-scope HTTP call. Redirects are not followed, so a server cannot send the agent elsewhere. */
export async function execHttp(tool: HttpTool, url: string, method: string, body: unknown, secrets: Record<string, string>, f: typeof fetch = fetch): Promise<{ ok: boolean; content: string; status: number | null }> {
  const u = new URL(url);
  if (isPrivateHost(u.hostname) && process.env.NODE_ENV !== 'test') return { ok: false, content: 'That address is on a private network.', status: null };
  const headers: Record<string, string> = { accept: 'application/json, text/plain;q=0.9, */*;q=0.5', 'user-agent': 'AIC-Agent-Runtime/1', ...secrets };
  const hasBody = method !== 'GET' && method !== 'DELETE' && body !== undefined;
  if (hasBody) headers['content-type'] = 'application/json';
  try {
    const res = await f(url, { method, headers, body: hasBody ? JSON.stringify(body) : undefined, redirect: 'manual', signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) });
    if (res.status >= 300 && res.status < 400) return { ok: false, content: `${tool.name} answered with a redirect (${res.status}); AIC does not follow redirects for agents.`, status: res.status };
    const text = await res.text();
    return { ok: res.ok, content: truncate(`HTTP ${res.status}\n${text}`), status: res.status };
  } catch (e) {
    return { ok: false, content: (e as Error).name === 'TimeoutError' ? `${tool.name} did not answer within ${HTTP_TIMEOUT_MS / 1000} seconds.` : `Could not reach ${tool.name}.`, status: null };
  }
}

/**
 * Runs the loop until the run finishes, fails, or waits for a person.
 * Returns the run as it was left.
 */
export async function advance(agent: AgentSnapshot, run: RunRecord, deps: EngineDeps): Promise<RunRecord> {
  const r: RunRecord = { ...run, state: { ...run.state, messages: [...run.state.messages] } };
  const tools = modelToolSpecs(agent.tools);
  const byName = new Map(agent.tools.map((t) => [t.name, t]));
  const f = deps.fetch ?? fetch;

  const finish = async (status: RunStatus, kind: StepKind, detail: Record<string, unknown>) => {
    r.status = status;
    r.state.pending = null;
    await deps.appendStep(kind, null, detail);
    await deps.saveRun(r);
    return r;
  };

  while (r.status === 'running') {
    if (!(await deps.agentIsActive())) { r.error = 'The agent was paused, so the run stopped.'; return finish('stopped', 'stopped', { reason: r.error }); }
    if (r.state.modelCalls >= agent.limits.maxSteps) { r.error = `Reached the limit of ${agent.limits.maxSteps} steps.`; return finish('failed', 'failed', { reason: r.error }); }
    if (r.inputTokens + r.outputTokens >= agent.limits.maxTokensPerRun) { r.error = `Reached the limit of ${agent.limits.maxTokensPerRun.toLocaleString('en-GB')} tokens for one run.`; return finish('failed', 'failed', { reason: r.error }); }

    let reply;
    try {
      reply = await callModel({ provider: agent.provider, model: agent.model, apiKey: agent.apiKey, system: systemPrompt(agent), messages: r.state.messages, tools, maxTokens: Math.min(MAX_TOKENS_PER_CALL, agent.limits.maxTokensPerRun - r.inputTokens - r.outputTokens) });
    } catch (e) {
      r.error = e instanceof ModelError ? e.message : 'The model call failed.';
      return finish('failed', 'failed', { reason: r.error });
    }
    r.state.modelCalls += 1;
    r.inputTokens += reply.inputTokens;
    r.outputTokens += reply.outputTokens;
    const cost = deps.priceOf(agent.model, reply.inputTokens, reply.outputTokens);
    if (cost !== null) r.costUsd += cost;
    await deps.recordUsage(agent.model, reply.inputTokens, reply.outputTokens, cost);
    await deps.appendStep('model', agent.model, { text: reply.text.slice(0, 4000), calls: reply.calls.map((c) => ({ name: c.name, input: c.input })), inputTokens: reply.inputTokens, outputTokens: reply.outputTokens });
    r.state.messages.push({ role: 'assistant', text: reply.text, calls: reply.calls });

    if (!reply.calls.length) {
      r.output = reply.text;
      return finish('completed', 'finished', { stop: reply.stop });
    }

    // Answer each call in order. The first that needs a person pauses the run;
    // calls after it are told to wait so the model can ask again.
    const results: { id: string; name: string; content: string; isError?: boolean }[] = [];
    for (let i = 0; i < reply.calls.length; i++) {
      const c = reply.calls[i];
      const tool = byName.get(c.name);
      await deps.appendStep('tool_call', c.name, { input: c.input });
      if (!tool) {
        await deps.appendStep('refused', c.name, { reason: 'No tool by that name.' });
        results.push({ id: c.id, name: c.name, content: `There is no tool called ${c.name}.`, isError: true });
        continue;
      }
      if (tool.kind === 'ask_a_person') {
        const question = String(c.input.question ?? '').slice(0, 2000) || 'The agent asked for help without a question.';
        await deps.appendStep('question', c.name, { question });
        return pause(r, { kind: 'question', call: c, question }, results, reply.calls.slice(i + 1), deps);
      }
      if (tool.kind === 'record_decision') {
        const outcome = String(c.input.outcome ?? '').slice(0, 500);
        const explanation = String(c.input.explanation ?? '').slice(0, 4000);
        if (!outcome || !explanation) {
          results.push({ id: c.id, name: c.name, content: 'Give both an outcome and an explanation.', isError: true });
          continue;
        }
        const d = await deps.recordDecision({ subject: c.input.subject ? String(c.input.subject).slice(0, 200) : null, outcome, explanation });
        await deps.appendStep('decision_recorded', c.name, { decisionId: d.id, outcome });
        results.push({ id: c.id, name: c.name, content: `Recorded as decision ${d.id}.` });
        continue;
      }
      if (tool.kind === 'sharepoint') {
        const sp = checkSharePointCall(tool, c.input);
        if (!sp.allowed) {
          await deps.appendStep('refused', c.name, { reason: sp.reason, action: c.input.action, path: c.input.path });
          results.push({ id: c.id, name: c.name, content: `Refused by AIC: ${sp.reason}`, isError: true });
          continue;
        }
        if (sp.needsApproval) {
          const body = sp.call.op === 'write' ? { replace: sp.call.replace, content: sp.call.content.slice(0, 4000) } : null;
          await deps.appendStep('approval_requested', c.name, { method: sp.call.op, url: sp.where, body });
          return pause(r, { kind: 'approval', call: c, url: sp.where, method: sp.call.op, body: body ?? undefined }, results, reply.calls.slice(i + 1), deps);
        }
        if (!(await deps.agentIsActive())) { r.error = 'The agent was paused, so the run stopped.'; return finish('stopped', 'stopped', { reason: r.error }); }
        const out = deps.sharePoint ? await deps.sharePoint(tool, sp.call) : { ok: false, content: 'SharePoint is not available here.' };
        await deps.appendStep('tool_result', c.name, { action: sp.call.op, path: sp.call.path, ok: out.ok, chars: out.content.length });
        results.push({ id: c.id, name: c.name, content: out.content, isError: !out.ok });
        continue;
      }
      const scope = checkHttpCall(tool, { method: String(c.input.method ?? ''), path: String(c.input.path ?? ''), query: (c.input.query as Record<string, string>) ?? undefined, body: c.input.body });
      if (!scope.allowed) {
        await deps.appendStep('refused', c.name, { reason: scope.reason, method: c.input.method, path: c.input.path });
        results.push({ id: c.id, name: c.name, content: `Refused by AIC: ${scope.reason}`, isError: true });
        continue;
      }
      if (scope.needsApproval) {
        await deps.appendStep('approval_requested', c.name, { method: scope.method, url: scope.url, body: c.input.body ?? null });
        return pause(r, { kind: 'approval', call: c, url: scope.url, method: scope.method, body: c.input.body }, results, reply.calls.slice(i + 1), deps);
      }
      if (!(await deps.agentIsActive())) { r.error = 'The agent was paused, so the run stopped.'; return finish('stopped', 'stopped', { reason: r.error }); }
      const out = await execHttp(tool, scope.url, scope.method, c.input.body, agent.toolSecrets[tool.name] ?? {}, f);
      await deps.appendStep('tool_result', c.name, { status: out.status, ok: out.ok, chars: out.content.length });
      results.push({ id: c.id, name: c.name, content: out.content, isError: !out.ok });
    }
    r.state.messages.push({ role: 'tool', results });
    await deps.saveRun(r);
  }
  return r;
}

async function pause(r: RunRecord, pending: Pending, done: { id: string; name: string; content: string; isError?: boolean }[], later: ToolCall[], deps: EngineDeps): Promise<RunRecord> {
  // Calls after the paused one are answered now, so the conversation stays
  // well formed; the model can repeat them once it has the person's answer.
  const skipped = later.map((c) => ({ id: c.id, name: c.name, content: 'Not run: waiting for a person on an earlier call. Ask again if you still need it.', isError: true }));
  r.state.pending = pending;
  r.state.messages.push({ role: 'tool', results: [...done, ...skipped] });
  r.status = 'waiting_for_person';
  await deps.saveRun(r);
  return r;
}

/**
 * A person's answer to a paused run: approve or deny the waiting call, or
 * answer the agent's question. The run then carries on.
 */
export async function resume(
  agent: AgentSnapshot, run: RunRecord, action: { kind: 'approve' } | { kind: 'deny'; reason?: string } | { kind: 'answer'; text: string },
  actorId: string, deps: EngineDeps,
): Promise<RunRecord | { error: string }> {
  const p = run.state.pending;
  if (run.status !== 'waiting_for_person' || !p) return { error: 'This run is not waiting for anyone.' };
  if (p.kind === 'question' && action.kind !== 'answer') return { error: 'The agent asked a question; answer it.' };
  if (p.kind === 'approval' && action.kind === 'answer') return { error: 'The agent is waiting for an approval, not an answer.' };

  const r: RunRecord = { ...run, status: 'running', state: { ...run.state, messages: [...run.state.messages], pending: null } };
  // The tool message pushed at pause holds the earlier results; the paused call's result goes first in a new one.
  let content: string; let isError = false;
  if (p.kind === 'question' && action.kind === 'answer') {
    await deps.appendStep('answer', p.call.name, { answer: action.text.slice(0, 4000) }, actorId);
    content = `The person answered: ${action.text.slice(0, 4000)}`;
  } else if (action.kind === 'deny') {
    await deps.appendStep('denied', p.call.name, { reason: action.reason ?? null }, actorId);
    content = `A person refused this call${action.reason ? `: ${action.reason}` : '.'} Do not try it another way.`;
    isError = true;
  } else {
    await deps.appendStep('approved', p.call.name, {}, actorId);
    if (!(await deps.agentIsActive())) { r.status = 'stopped'; r.error = 'The agent was paused, so the run stopped.'; await deps.appendStep('stopped', null, { reason: r.error }); await deps.saveRun(r); return r; }
    const tool = agent.tools.find((t) => t.name === p.call.name);
    if (!tool || (tool.kind !== 'http' && tool.kind !== 'sharepoint') || p.kind !== 'approval') return { error: 'The tool is no longer set up on this agent.' };
    if (tool.kind === 'sharepoint') {
      // Checked again against the tool as it is now, in case it was narrowed while the run waited.
      const sp = checkSharePointCall(tool, p.call.input);
      const out = !sp.allowed ? { ok: false, content: `Refused by AIC: ${sp.reason}` }
        : deps.sharePoint ? await deps.sharePoint(tool, sp.call) : { ok: false, content: 'SharePoint is not available here.' };
      await deps.appendStep('tool_result', tool.name, { action: sp.allowed ? sp.call.op : null, path: sp.allowed ? sp.call.path : null, ok: out.ok, chars: out.content.length });
      content = out.content; isError = !out.ok;
    } else {
      const out = await execHttp(tool, p.url, p.method, p.body, agent.toolSecrets[tool.name] ?? {}, deps.fetch ?? fetch);
      await deps.appendStep('tool_result', tool.name, { status: out.status, ok: out.ok, chars: out.content.length });
      content = out.content; isError = !out.ok;
    }
  }
  // Put the paused call's result in the tool message pushed at pause.
  const last = r.state.messages[r.state.messages.length - 1];
  if (last?.role === 'tool') {
    r.state.messages[r.state.messages.length - 1] = { role: 'tool', results: [{ id: p.call.id, name: p.call.name, content, isError }, ...last.results] };
  } else {
    r.state.messages.push({ role: 'tool', results: [{ id: p.call.id, name: p.call.name, content, isError }] });
  }
  await deps.saveRun(r);
  return advance(agent, r, deps);
}
