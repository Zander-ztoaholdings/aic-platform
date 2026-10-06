/**
 * Agents: configuration and scope.
 *
 * An agent is a model, a set of instructions, a short list of tools and hard
 * limits. Its scope is enforced by AIC at run time, not by asking the model
 * to behave: a call to an address outside the allow-list, a method the tool
 * does not allow, or a write that needs a person's approval never reaches the
 * outside world until the rule is met.
 *
 * The agent runtime is a tool. Using it, or not, neither raises nor lowers an
 * organisation's chance of being certified by AIC (TOOLS_NOTICE).
 *
 * Pure: tested in __tests__/lib/agents.test.ts.
 */
import { isPrivateHost } from '../connectors/http';

export const TOOLS_NOTICE =
  'The agent runtime is a tool AIC offers for your own use. Using it is optional, and it neither raises nor lowers your chance of being certified by AIC: an assessment looks at the evidence for each requirement, wherever your agents run.';

export const AGENT_PROVIDERS = ['anthropic', 'openai'] as const;
export type AgentProvider = (typeof AGENT_PROVIDERS)[number];
export const PROVIDER_LABEL: Record<AgentProvider, string> = { anthropic: 'Anthropic', openai: 'OpenAI' };

/** Models offered when creating an agent: current ones only (lib/ai-prices.ts lists the rest). */
export const AGENT_MODELS: Record<AgentProvider, { id: string; label: string }[]> = {
  anthropic: [
    { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (balanced)' },
    { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (most capable)' },
    { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (fast, lowest cost)' },
  ],
  openai: [
    { id: 'gpt-6.1-sol', label: 'GPT-6.1 Sol (balanced)' },
    { id: 'gpt-6-astra', label: 'GPT-6 Astra (most capable)' },
    { id: 'gpt-6-luna', label: 'GPT-6 Luna (fast, lowest cost)' },
  ],
};

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export type Approval = 'never' | 'writes' | 'always';
export const APPROVAL_LABEL: Record<Approval, string> = {
  never: 'Runs without asking',
  writes: 'A person approves anything that changes data',
  always: 'A person approves every call',
};

export type HttpTool = {
  kind: 'http';
  name: string;
  description: string;
  baseUrl: string;
  methods: HttpMethod[];
  /** Paths under baseUrl the agent may use. Empty means any path under it. */
  pathPrefixes: string[];
  approval: Approval;
  /** Header names whose values are kept encrypted and added by AIC, never shown to the model. */
  secretHeaders: string[];
};
export type AskTool = { kind: 'ask_a_person'; name: 'ask_a_person' };
export type DecisionTool = { kind: 'record_decision'; name: 'record_decision' };
export type AgentTool = HttpTool | AskTool | DecisionTool;

export type AgentLimits = {
  maxSteps: number;
  maxTokensPerRun: number;
  maxRunsPerDay: number;
  /** US dollars a month; null for no cap beyond the provider account's own. */
  monthlyBudgetUsd: number | null;
};

export const DEFAULT_LIMITS: AgentLimits = { maxSteps: 10, maxTokensPerRun: 60_000, maxRunsPerDay: 200, monthlyBudgetUsd: null };
export const LIMIT_RANGE = { maxSteps: [1, 50], maxTokensPerRun: [1_000, 1_000_000], maxRunsPerDay: [1, 10_000] } as const;

export const TOOL_NAME = /^[a-z][a-z0-9_]{1,39}$/;
const RESERVED = ['ask_a_person', 'record_decision'];

const str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const clamp = (v: unknown, [lo, hi]: readonly [number, number], d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : d;
};

export function slugify(name: string): string {
  return name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'agent';
}

/** Cleans one tool from a request, or explains what is wrong with it. */
export function cleanTool(t: unknown): { tool: AgentTool } | { error: string } {
  const o = (t ?? {}) as Record<string, unknown>;
  if (o.kind === 'ask_a_person') return { tool: { kind: 'ask_a_person', name: 'ask_a_person' } };
  if (o.kind === 'record_decision') return { tool: { kind: 'record_decision', name: 'record_decision' } };
  if (o.kind !== 'http') return { error: 'Unknown kind of tool.' };
  const name = str(o.name, 40).toLowerCase();
  if (!TOOL_NAME.test(name) || RESERVED.includes(name)) return { error: `“${name || 'tool'}” is not a usable tool name: use lower case letters, numbers and underscores.` };
  const description = str(o.description, 600);
  if (description.length < 10) return { error: `Describe what ${name} is for, so the model knows when to use it.` };
  let base: URL;
  try { base = new URL(str(o.baseUrl, 300)); } catch { return { error: `${name}: the address is not a web address.` }; }
  if (base.protocol !== 'https:') return { error: `${name}: the address must start with https://` };
  if (base.username || base.password) return { error: `${name}: keep user names and passwords out of the address; add them as a secret header.` };
  if (isPrivateHost(base.hostname) && process.env.NODE_ENV !== 'test') return { error: `${name}: AIC can only reach addresses on the internet, not a private network.` };
  if (base.search || base.hash) return { error: `${name}: give the address without a query string.` };
  const methods = (Array.isArray(o.methods) ? o.methods : []).map((m) => String(m).toUpperCase()).filter((m): m is HttpMethod => (HTTP_METHODS as readonly string[]).includes(m));
  if (!methods.length) return { error: `${name}: allow at least one method.` };
  const pathPrefixes = (Array.isArray(o.pathPrefixes) ? o.pathPrefixes : [])
    .map((p) => str(p, 200)).filter(Boolean).map((p) => (p.startsWith('/') ? p : `/${p}`)).slice(0, 20);
  if (pathPrefixes.some((p) => p.includes('..'))) return { error: `${name}: paths may not contain “..”.` };
  const approval: Approval = o.approval === 'never' || o.approval === 'always' ? o.approval : 'writes';
  const secretHeaders = (Array.isArray(o.secretHeaders) ? o.secretHeaders : []).map((h) => str(h, 60)).filter((h) => /^[A-Za-z0-9-]+$/.test(h)).slice(0, 5);
  const baseUrl = `${base.origin}${base.pathname.replace(/\/+$/, '')}`;
  return { tool: { kind: 'http', name, description, baseUrl, methods: [...new Set(methods)], pathPrefixes, approval, secretHeaders } };
}

export function cleanLimits(l: unknown): AgentLimits {
  const o = (l ?? {}) as Record<string, unknown>;
  const budget = o.monthlyBudgetUsd === null || o.monthlyBudgetUsd === '' || o.monthlyBudgetUsd === undefined ? null : Number(o.monthlyBudgetUsd);
  return {
    maxSteps: clamp(o.maxSteps, LIMIT_RANGE.maxSteps, DEFAULT_LIMITS.maxSteps),
    maxTokensPerRun: clamp(o.maxTokensPerRun, LIMIT_RANGE.maxTokensPerRun, DEFAULT_LIMITS.maxTokensPerRun),
    maxRunsPerDay: clamp(o.maxRunsPerDay, LIMIT_RANGE.maxRunsPerDay, DEFAULT_LIMITS.maxRunsPerDay),
    monthlyBudgetUsd: budget !== null && Number.isFinite(budget) && budget > 0 ? Math.round(budget * 100) / 100 : null,
  };
}

export type AgentInput = {
  name: string; purpose: string | null; provider: AgentProvider; model: string; instructions: string;
  tools: AgentTool[]; limits: AgentLimits; aiSystemId: string | null; ownerUserId: string | null;
};

/** Validates the editable parts of an agent. */
export function cleanAgent(b: Record<string, unknown>): { value: AgentInput } | { error: string } {
  const name = str(b.name, 120);
  if (name.length < 2) return { error: 'Give the agent a name.' };
  const provider = b.provider as AgentProvider;
  if (!AGENT_PROVIDERS.includes(provider)) return { error: 'Choose Anthropic or OpenAI.' };
  const model = str(b.model, 120);
  if (!model) return { error: 'Choose a model.' };
  const instructions = typeof b.instructions === 'string' ? b.instructions.slice(0, 20_000) : '';
  const tools: AgentTool[] = [];
  for (const t of Array.isArray(b.tools) ? b.tools.slice(0, 12) : []) {
    const r = cleanTool(t);
    if ('error' in r) return { error: r.error };
    if (tools.some((x) => x.name === r.tool.name)) return { error: `Two tools are called ${r.tool.name}.` };
    tools.push(r.tool);
  }
  const uuid = (v: unknown) => (typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v) ? v : null);
  return { value: { name, purpose: str(b.purpose, 1000) || null, provider, model, instructions, tools, limits: cleanLimits(b.limits), aiSystemId: uuid(b.aiSystemId), ownerUserId: uuid(b.ownerUserId) } };
}

/** What stops an agent being switched on, in plain words; empty when it can run. */
export function readinessProblems(a: { instructions: string; modelKeyHint: string | null; ownerUserId: string | null; tools: AgentTool[]; aiSystemId: string | null }): string[] {
  const out: string[] = [];
  if (!a.modelKeyHint) out.push('Add the model key the agent runs with.');
  if (!a.ownerUserId) out.push('Name the person accountable for this agent.');
  if (a.instructions.trim().length < 20) out.push('Write instructions of at least a sentence or two.');
  if (a.tools.some((t) => t.kind === 'record_decision') && !a.aiSystemId) out.push('Link the agent to a declared AI system, so its decisions land in that system’s log.');
  return out;
}

// ── Scope: is this call allowed, and does it need a person? ─────────────────

export type HttpCall = { method: string; path: string; query?: Record<string, string>; body?: unknown };

export type ScopeDecision =
  | { allowed: false; reason: string }
  | { allowed: true; url: string; method: HttpMethod; needsApproval: boolean };

/**
 * Checks one HTTP call the model asked for against the tool's scope. The
 * model chooses the method and path; the address, the allowed methods and the
 * allowed paths come only from the tool, so the model cannot reach anything
 * the tool was not set up for.
 */
export function checkHttpCall(tool: HttpTool, call: HttpCall): ScopeDecision {
  const method = String(call.method ?? '').toUpperCase() as HttpMethod;
  if (!(HTTP_METHODS as readonly string[]).includes(method) || !tool.methods.includes(method)) {
    return { allowed: false, reason: `${tool.name} may only use ${tool.methods.join(', ')}.` };
  }
  const raw = String(call.path ?? '');
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('//')) return { allowed: false, reason: 'Give a path, not a full address; the address is fixed by the tool.' };
  if (raw.includes('..') || raw.includes('\\') || /%2e%2e|%2f/i.test(raw)) return { allowed: false, reason: 'That path is not allowed.' };
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  if (tool.pathPrefixes.length && !tool.pathPrefixes.some((p) => path === p || path.startsWith(p.endsWith('/') ? p : `${p}/`) || path.startsWith(`${p}?`))) {
    return { allowed: false, reason: `${tool.name} may only use ${tool.pathPrefixes.join(', ')}.` };
  }
  const url = new URL(tool.baseUrl + path);
  const base = new URL(tool.baseUrl);
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname.replace(/\/+$/, ''))) return { allowed: false, reason: 'That path leaves the tool’s address.' };
  for (const [k, v] of Object.entries(call.query ?? {})) url.searchParams.set(String(k).slice(0, 100), String(v).slice(0, 1000));
  const write = method !== 'GET';
  const needsApproval = tool.approval === 'always' || (tool.approval === 'writes' && write);
  return { allowed: true, url: url.toString(), method, needsApproval };
}

/** The tool definitions the model sees. Secret headers and the address rules are not in them. */
export function modelToolSpecs(tools: AgentTool[]): { name: string; description: string; schema: Record<string, unknown> }[] {
  return tools.map((t) => {
    if (t.kind === 'ask_a_person') {
      return { name: t.name, description: 'Ask the accountable person a question and wait for their answer. Use it when you are unsure, or before doing anything you have been told needs a person.', schema: { type: 'object', properties: { question: { type: 'string' } }, required: ['question'] } };
    }
    if (t.kind === 'record_decision') {
      return { name: t.name, description: 'Record a decision this agent made about a person or case in the organisation’s decision log, with the outcome and a plain explanation. Use it whenever you decide something that affects someone.', schema: { type: 'object', properties: { subject: { type: 'string', description: 'A reference for the case, not personal details' }, outcome: { type: 'string' }, explanation: { type: 'string' } }, required: ['outcome', 'explanation'] } };
    }
    return {
      name: t.name,
      description: `${t.description} Calls ${t.baseUrl}${t.pathPrefixes.length ? ` (paths ${t.pathPrefixes.join(', ')})` : ''} with ${t.methods.join(', ')}.`,
      schema: { type: 'object', properties: { method: { type: 'string', enum: t.methods }, path: { type: 'string', description: 'Path under the tool’s address, starting with /' }, query: { type: 'object', additionalProperties: { type: 'string' } }, body: { description: 'JSON body for POST, PUT or PATCH' } }, required: ['method', 'path'] },
    };
  });
}
