import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanTool, cleanAgent, checkHttpCall, readinessProblems, cleanLimits, type HttpTool, type AgentTool } from '@/lib/agents/config';
import { advance, resume, stepHash, verifyChain, type AgentSnapshot, type EngineDeps, type RunRecord } from '@/lib/agents/engine';

const tool: HttpTool = { kind: 'http', name: 'claims_api', description: 'Reads and updates claims.', baseUrl: 'https://api.example.co.za/v1', methods: ['GET', 'POST'], pathPrefixes: ['/claims'], approval: 'writes', secretHeaders: ['Authorization'] };

describe('cleanTool', () => {
  it('accepts a well formed tool and trims the address', () => {
    const r = cleanTool({ ...tool, baseUrl: 'https://api.example.co.za/v1/', methods: ['get', 'post', 'nonsense'] });
    expect(r).toMatchObject({ tool: { baseUrl: 'https://api.example.co.za/v1', methods: ['GET', 'POST'] } });
  });
  it('refuses plain http, credentials in the address and query strings', () => {
    expect(cleanTool({ ...tool, baseUrl: 'http://api.example.co.za' })).toHaveProperty('error');
    expect(cleanTool({ ...tool, baseUrl: 'https://u:p@api.example.co.za' })).toHaveProperty('error');
    expect(cleanTool({ ...tool, baseUrl: 'https://api.example.co.za?x=1' })).toHaveProperty('error');
  });
  it('refuses reserved and badly formed names', () => {
    expect(cleanTool({ ...tool, name: 'ask_a_person' })).toHaveProperty('error');
    expect(cleanTool({ ...tool, name: 'Bad Name' })).toHaveProperty('error');
  });
});

describe('checkHttpCall: the scope is AIC’s, not the model’s', () => {
  it('allows an in-scope read without approval', () => {
    expect(checkHttpCall(tool, { method: 'GET', path: '/claims/42', query: { full: 'yes' } })).toEqual({ allowed: true, method: 'GET', url: 'https://api.example.co.za/v1/claims/42?full=yes', needsApproval: false });
  });
  it('makes writes wait for a person', () => {
    expect(checkHttpCall(tool, { method: 'POST', path: '/claims' })).toMatchObject({ allowed: true, needsApproval: true });
  });
  it.each([
    ['a method the tool does not allow', { method: 'DELETE', path: '/claims/1' }],
    ['a path outside the prefixes', { method: 'GET', path: '/users' }],
    ['a prefix look-alike', { method: 'GET', path: '/claimsadmin' }],
    ['a full address', { method: 'GET', path: 'https://evil.example/claims' }],
    ['a protocol-relative address', { method: 'GET', path: '//evil.example/claims' }],
    ['dot-dot traversal', { method: 'GET', path: '/claims/../admin' }],
    ['encoded traversal', { method: 'GET', path: '/claims/%2e%2e/admin' }],
  ])('refuses %s', (_l, call) => {
    expect(checkHttpCall(tool, call).allowed).toBe(false);
  });
});

describe('cleanAgent and readiness', () => {
  it('needs a key, an owner, instructions, and a linked system for decisions', () => {
    const tools: AgentTool[] = [{ kind: 'record_decision', name: 'record_decision' }];
    expect(readinessProblems({ instructions: '', modelKeyHint: null, ownerUserId: null, tools, aiSystemId: null })).toHaveLength(4);
    expect(readinessProblems({ instructions: 'Sort new claims by urgency and ask when unsure.', modelKeyHint: '…abcd', ownerUserId: 'u', tools, aiSystemId: 's' })).toEqual([]);
  });
  it('refuses duplicate tool names and clamps limits', () => {
    expect(cleanAgent({ name: 'Triage', provider: 'anthropic', model: 'claude-sonnet-5-5', tools: [tool, tool] })).toHaveProperty('error');
    expect(cleanLimits({ maxSteps: 999, maxTokensPerRun: 5, maxRunsPerDay: 'x', monthlyBudgetUsd: -1 })).toEqual({ maxSteps: 50, maxTokensPerRun: 1000, maxRunsPerDay: 200, monthlyBudgetUsd: null });
  });
});

describe('step chain', () => {
  it('verifies, and notices an edited step', () => {
    const a = { seq: 1, kind: 'started', name: null, detail: { input: 'x' } };
    const h1 = stepHash(null, a);
    const b = { seq: 2, kind: 'model', name: 'm', detail: { text: 'hi' } };
    const h2 = stepHash(h1, b);
    const steps = [{ ...a, prevHash: null, hash: h1 }, { ...b, prevHash: h1, hash: h2 }];
    expect(verifyChain(steps)).toBe(true);
    expect(verifyChain([steps[0], { ...steps[1], detail: { text: 'changed' } }])).toBe(false);
  });
  it('survives jsonb reordering keys', () => {
    const h = stepHash(null, { seq: 1, kind: 'model', name: null, detail: { text: 'a', calls: [], inputTokens: 1 } });
    expect(verifyChain([{ seq: 1, kind: 'model', name: null, detail: { calls: [], inputTokens: 1, text: 'a' }, prevHash: null, hash: h }])).toBe(true);
  });
});

// ── The loop, with the model and the outside world mocked ─────────────────

const agent: AgentSnapshot = {
  id: 'a1', name: 'Triage', provider: 'anthropic', model: 'claude-sonnet-5-5', instructions: 'Sort claims.', orgName: 'Highveld Mutual (Demo)',
  tools: [tool, { kind: 'ask_a_person', name: 'ask_a_person' }, { kind: 'record_decision', name: 'record_decision' }],
  limits: { maxSteps: 5, maxTokensPerRun: 60_000, maxRunsPerDay: 10, monthlyBudgetUsd: null },
  apiKey: 'sk-ant-test-key-000000000000', toolSecrets: { claims_api: { Authorization: 'Bearer secret-token' } },
};

const anthropic = (content: unknown[]) => new Response(JSON.stringify({ content, usage: { input_tokens: 100, output_tokens: 20 }, stop_reason: content.some((c) => (c as { type: string }).type === 'tool_use') ? 'tool_use' : 'end_turn' }), { status: 200 });

function harness(replies: Response[], active = true) {
  const steps: { kind: string; name: string | null; detail: Record<string, unknown> }[] = [];
  const outside: { url: string; init: RequestInit }[] = [];
  const decisions: unknown[] = [];
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('api.anthropic.com')) return replies.shift() ?? anthropic([{ type: 'text', text: 'done' }]);
    outside.push({ url: u, init: init ?? {} });
    return new Response('{"claims":[{"id":42}]}', { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  const deps: EngineDeps = {
    appendStep: async (kind, name, detail) => { steps.push({ kind, name, detail }); },
    saveRun: async () => {},
    agentIsActive: async () => active,
    priceOf: (_m, i, o) => (i * 2 + o * 10) / 1e6,
    recordUsage: async () => {},
    recordDecision: async (d) => { decisions.push(d); return { id: 'd1' }; },
    fetch: fetchMock as unknown as typeof fetch,
  };
  return { steps, outside, decisions, deps, fetchMock };
}
const fresh = (): RunRecord => ({ id: 'r1', status: 'running', state: { messages: [{ role: 'user', text: 'Sort today’s claims' }], modelCalls: 0, pending: null }, inputTokens: 0, outputTokens: 0, costUsd: 0, output: null, error: null });

describe('advance', () => {
  beforeEach(() => { vi.unstubAllGlobals(); });

  it('makes an in-scope read with the secret header, then finishes', async () => {
    const h = harness([anthropic([{ type: 'tool_use', id: 't1', name: 'claims_api', input: { method: 'GET', path: '/claims' } }]), anthropic([{ type: 'text', text: 'Two urgent claims.' }])]);
    const r = await advance(agent, fresh(), h.deps);
    expect(r.status).toBe('completed');
    expect(r.output).toBe('Two urgent claims.');
    expect(h.outside).toHaveLength(1);
    expect((h.outside[0].init.headers as Record<string, string>).Authorization).toBe('Bearer secret-token');
    expect(h.outside[0].init.redirect).toBe('manual');
    expect(r.costUsd).toBeCloseTo(2 * (200 + 200) / 1e6);
    // The secret never reaches the chain or the model.
    expect(JSON.stringify(h.steps)).not.toContain('secret-token');
    const modelBodies = h.fetchMock.mock.calls.filter((c) => String(c[0]).includes('anthropic')).map((c) => String((c[1] as RequestInit).body));
    expect(modelBodies.join('')).not.toContain('secret-token');
  });

  it('refuses an out-of-scope call without touching the outside world', async () => {
    const h = harness([anthropic([{ type: 'tool_use', id: 't1', name: 'claims_api', input: { method: 'GET', path: 'https://evil.example/x' } }]), anthropic([{ type: 'text', text: 'Could not.' }])]);
    const r = await advance(agent, fresh(), h.deps);
    expect(r.status).toBe('completed');
    expect(h.outside).toHaveLength(0);
    expect(h.steps.some((s) => s.kind === 'refused')).toBe(true);
  });

  it('pauses a write for approval, and only calls out once approved', async () => {
    const h = harness([anthropic([{ type: 'tool_use', id: 't1', name: 'claims_api', input: { method: 'POST', path: '/claims/42/flag', body: { urgent: true } } }])]);
    const paused = await advance(agent, fresh(), h.deps);
    expect(paused.status).toBe('waiting_for_person');
    expect(paused.state.pending).toMatchObject({ kind: 'approval', method: 'POST' });
    expect(h.outside).toHaveLength(0);
    const done = await resume(agent, paused, { kind: 'approve' }, 'u1', h.deps);
    expect(done).toMatchObject({ status: 'completed' });
    expect(h.outside).toHaveLength(1);
    expect(h.outside[0].init.body).toBe('{"urgent":true}');
  });

  it('a refusal reaches the model and nothing goes out', async () => {
    const h = harness([anthropic([{ type: 'tool_use', id: 't1', name: 'claims_api', input: { method: 'POST', path: '/claims' } }])]);
    const paused = await advance(agent, fresh(), h.deps);
    const done = await resume(agent, paused, { kind: 'deny', reason: 'Not today' }, 'u1', h.deps);
    expect(done).toMatchObject({ status: 'completed' });
    expect(h.outside).toHaveLength(0);
    expect(h.steps.some((s) => s.kind === 'denied')).toBe(true);
  });

  it('asks a person and carries on with the answer', async () => {
    const h = harness([anthropic([{ type: 'tool_use', id: 't1', name: 'ask_a_person', input: { question: 'Is claim 42 urgent?' } }]), anthropic([{ type: 'text', text: 'Marked urgent.' }])]);
    const paused = await advance(agent, fresh(), h.deps);
    expect(paused.state.pending).toMatchObject({ kind: 'question', question: 'Is claim 42 urgent?' });
    expect(await resume(agent, paused, { kind: 'approve' }, 'u1', h.deps)).toHaveProperty('error');
    const done = await resume(agent, paused, { kind: 'answer', text: 'Yes' }, 'u1', h.deps);
    expect(done).toMatchObject({ status: 'completed', output: 'Marked urgent.' });
  });

  it('records decisions in the decision log', async () => {
    const h = harness([anthropic([{ type: 'tool_use', id: 't1', name: 'record_decision', input: { subject: 'CLM-42', outcome: 'Urgent', explanation: 'Water damage, family displaced.' } }])]);
    await advance(agent, fresh(), h.deps);
    expect(h.decisions).toEqual([{ subject: 'CLM-42', outcome: 'Urgent', explanation: 'Water damage, family displaced.' }]);
  });

  it('stops when the agent is paused (kill switch)', async () => {
    const h = harness([], false);
    const r = await advance(agent, fresh(), h.deps);
    expect(r.status).toBe('stopped');
    expect(h.fetchMock).not.toHaveBeenCalled();
  });

  it('stops at the step limit', async () => {
    const loop = () => anthropic([{ type: 'tool_use', id: `t${Math.random()}`, name: 'claims_api', input: { method: 'GET', path: '/claims' } }]);
    const h = harness([loop(), loop(), loop(), loop(), loop(), loop()]);
    const r = await advance(agent, fresh(), h.deps);
    expect(r.status).toBe('failed');
    expect(r.error).toMatch(/limit of 5 steps/);
  });

  it('a refused model key fails the run plainly', async () => {
    const h = harness([new Response('{"error":{"message":"invalid x-api-key"}}', { status: 401 })]);
    const r = await advance(agent, fresh(), h.deps);
    expect(r).toMatchObject({ status: 'failed', error: 'The provider refused the model key.' });
  });
});
