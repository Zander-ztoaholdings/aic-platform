import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanSharePointTool, checkSharePointCall, graphItemPath, type SharePointTool } from '@/lib/agents/sharepoint-scope';
import { cleanTool, readinessProblems, modelToolSpecs } from '@/lib/agents/config';
import { advance, resume, type AgentSnapshot, type EngineDeps, type RunRecord } from '@/lib/agents/engine';

const TENANT = '11111111-2222-3333-4444-555555555555';
const tool: SharePointTool = {
  kind: 'sharepoint', name: 'policies', description: 'The policy library.', tenantId: TENANT,
  siteUrl: 'https://contoso.sharepoint.com/sites/Policies', library: 'Documents', folder: 'HR', access: 'write', approval: 'writes',
};

describe('cleanSharePointTool', () => {
  const base = { name: 'policies', description: 'The policy library.' };
  it('accepts a site address and normalises it', () => {
    const r = cleanSharePointTool({ siteUrl: 'https://Contoso.sharepoint.com/sites/Policies/', library: '', folder: '/HR/Leave/' }, base.name, base.description);
    expect(r).toMatchObject({ tool: { siteUrl: 'https://contoso.sharepoint.com/sites/Policies', library: 'Documents', folder: 'HR/Leave', access: 'read', tenantId: null } });
  });
  it.each([
    ['not SharePoint Online', 'https://example.com/sites/x'],
    ['a page in the site', 'https://contoso.sharepoint.com/sites/Policies/SitePages/Home.aspx'],
    ['plain http', 'http://contoso.sharepoint.com/sites/Policies'],
    ['the tenant root', 'https://contoso.sharepoint.com/'],
  ])('refuses %s', (_l, siteUrl) => {
    expect(cleanSharePointTool({ siteUrl }, base.name, base.description)).toHaveProperty('error');
  });
  it('refuses traversal in the folder', () => {
    expect(cleanSharePointTool({ siteUrl: tool.siteUrl, folder: 'HR/../Finance' }, base.name, base.description)).toHaveProperty('error');
  });
  it('is reachable through cleanTool, and needs a tenant before it can run', () => {
    const r = cleanTool({ kind: 'sharepoint', ...base, siteUrl: tool.siteUrl });
    expect(r).toHaveProperty('tool.kind', 'sharepoint');
    const t = (r as { tool: SharePointTool }).tool;
    expect(readinessProblems({ instructions: 'Answer questions from the policy library.', modelKeyHint: '…1', ownerUserId: 'u', tools: [t], aiSystemId: null })).toEqual(['Connect Microsoft 365 for policies, so AIC can reach the site.']);
  });
});

describe('checkSharePointCall', () => {
  it('keeps every path inside the folder', () => {
    expect(checkSharePointCall(tool, { action: 'list', path: '' })).toMatchObject({ allowed: true, call: { op: 'list', path: 'HR' }, needsApproval: false });
    expect(checkSharePointCall(tool, { action: 'read', path: '/Leave/Policy.docx' })).toMatchObject({ allowed: true, call: { op: 'read', path: 'HR/Leave/Policy.docx' } });
  });
  it.each([
    ['traversal', { action: 'read', path: '../Finance/Pay.docx' }],
    ['a dot segment', { action: 'list', path: 'Leave/./..' }],
    ['Graph path syntax', { action: 'read', path: 'x:/children' }],
    ['a backslash', { action: 'read', path: 'a\\b.md' }],
    ['an unreadable type', { action: 'read', path: 'payroll.xlsx' }],
    ['an unknown action', { action: 'search', path: 'salary' }],
    ['writing a Word file', { action: 'write', path: 'new.docx', content: 'x' }],
    ['an empty write', { action: 'write', path: 'new.md', content: '' }],
  ])('refuses %s', (_l, input) => {
    expect(checkSharePointCall(tool, input).allowed).toBe(false);
  });
  it('writes wait for a person and do not overwrite unless asked', () => {
    expect(checkSharePointCall(tool, { action: 'write', path: 'Draft.md', content: '# Draft' })).toMatchObject({ allowed: true, needsApproval: true, call: { op: 'write', path: 'HR/Draft.md', replace: false } });
  });
  it('a read-only tool cannot write, and the model is not offered write', () => {
    const ro = { ...tool, access: 'read' as const };
    expect(checkSharePointCall(ro, { action: 'write', path: 'a.md', content: 'x' })).toMatchObject({ allowed: false });
    const spec = modelToolSpecs([ro])[0].schema as { properties: { action: { enum: string[] } } };
    expect(spec.properties.action.enum).toEqual(['list', 'read']);
  });
  it('builds Graph addresses from the fixed drive only, encoding each segment', () => {
    expect(graphItemPath('b!abc', 'HR/Leave Policy #2.md', ':/content')).toBe('/drives/b!abc/root:/HR/Leave%20Policy%20%232.md:/content');
    expect(graphItemPath('b!abc', '', ':/children')).toBe('/drives/b!abc/root/children');
  });
});

// ── Graph, mocked ────────────────────────────────────────────────────────────

type Route = (url: string, init?: RequestInit) => Response | undefined;
function graphMock(extra: Route = () => undefined, opts: { rootId?: string; grantedSite?: boolean } = {}) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const f = vi.fn(async (u: string | URL | Request, init?: RequestInit) => {
    const url = String(u);
    calls.push({ url, init });
    const x = extra(url, init);
    if (x) return x;
    if (url.includes('/oauth2/v2.0/token')) return Response.json({ access_token: 'tok', expires_in: 3600 });
    if (url.includes('/sites/contoso.sharepoint.com:/sites/Policies')) return opts.grantedSite === false ? new Response('', { status: 403 }) : Response.json({ id: 'site-1', displayName: 'Policies' });
    if (url.includes('/sites/site-1/drives')) return Response.json({ value: [{ id: 'drive-1', name: 'Documents' }, { id: 'drive-2', name: 'Archive' }] });
    if (url.includes('/sites/root')) return opts.rootId ? Response.json({ id: opts.rootId }) : new Response('', { status: 403 });
    if (url.includes('/sites/site-1/permissions')) return new Response('', { status: 403 });
    return new Response('not mocked ' + url, { status: 500 });
  });
  return { f: f as unknown as typeof fetch, calls };
}

describe('runSharePoint and checkAccess', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.MS_AGENT_CLIENT_ID = 'agent-app';
    process.env.MS_AGENT_CLIENT_SECRET = 'secret';
  });

  it('lists the folder through the fixed drive', async () => {
    const { runSharePoint } = await import('@/lib/agents/sharepoint');
    const g = graphMock((url) => (url.includes('/drives/drive-1/root:/HR:/children') ? Response.json({ value: [{ name: 'Leave', folder: {} }, { name: 'Code.md', size: 2048, lastModifiedDateTime: '2026-09-01T00:00:00Z' }] }) : undefined));
    const out = await runSharePoint(tool, { op: 'list', path: 'HR' }, g.f);
    expect(out).toEqual({ ok: true, content: 'Leave/\nCode.md  (2 KB, changed 2026-09-01)' });
    expect(g.calls.every((c) => !c.url.includes('/search'))).toBe(true);
  });

  it('follows a download redirect only to SharePoint', async () => {
    const { runSharePoint } = await import('@/lib/agents/sharepoint');
    const meta = (url: string) => (url.includes('root:/HR/Code.md?') ? Response.json({ name: 'Code.md', size: 10, file: {} }) : undefined);
    const good = graphMock((url) => meta(url) ?? (url.endsWith('root:/HR/Code.md:/content') ? new Response(null, { status: 302, headers: { location: 'https://contoso.sharepoint.com/_layouts/download?x=1' } }) : url.startsWith('https://contoso.sharepoint.com/_layouts') ? new Response('# Code of conduct') : undefined));
    expect(await runSharePoint(tool, { op: 'read', path: 'HR/Code.md' }, good.f)).toEqual({ ok: true, content: '# Code of conduct' });
    const bad = graphMock((url) => meta(url) ?? (url.endsWith(':/content') ? new Response(null, { status: 302, headers: { location: 'https://evil.example/steal' } }) : undefined));
    const out = await runSharePoint(tool, { op: 'read', path: 'HR/Code.md' }, bad.f);
    expect(out.ok).toBe(false);
    expect(bad.calls.some((c) => c.url.includes('evil.example'))).toBe(false);
  });

  it('a write does not overwrite unless asked', async () => {
    const { runSharePoint } = await import('@/lib/agents/sharepoint');
    const g = graphMock((url, init) => (init?.method === 'PUT' ? (url.includes('conflictBehavior=fail') ? new Response('', { status: 409 }) : Response.json({ webUrl: 'https://contoso.sharepoint.com/x' })) : undefined));
    expect((await runSharePoint(tool, { op: 'write', path: 'HR/Draft.md', content: 'x', replace: false }, g.f)).content).toMatch(/already exists/);
    expect(await runSharePoint(tool, { op: 'write', path: 'HR/Draft.md', content: 'x', replace: true }, g.f)).toMatchObject({ ok: true });
  });

  it('explains an ungranted site', async () => {
    const { runSharePoint } = await import('@/lib/agents/sharepoint');
    const out = await runSharePoint(tool, { op: 'list', path: '' }, graphMock(undefined, { grantedSite: false }).f);
    expect(out).toMatchObject({ ok: false });
    expect(out.content).toMatch(/has not been given/);
  });

  it('checkAccess flags an app that can see more than the one site', async () => {
    const { checkAccess } = await import('@/lib/agents/sharepoint');
    expect(await checkAccess(tool, graphMock().f)).toMatchObject({ ok: true, siteName: 'Policies', libraryName: 'Documents', wider: false });
    expect(await checkAccess(tool, graphMock(undefined, { rootId: 'root-site' }).f)).toMatchObject({ wider: true });
  });
});

// ── In the loop ─────────────────────────────────────────────────────────────

describe('a SharePoint write in a run', () => {
  it('pauses for approval and runs only once approved', async () => {
    const replies = [
      { content: [{ type: 'tool_use', id: 't1', name: 'policies', input: { action: 'write', path: 'Draft.md', content: '# Leave policy draft' } }] },
      { content: [{ type: 'text', text: 'Saved the draft.' }] },
    ];
    const f = vi.fn(async () => Response.json({ ...replies.shift(), usage: { input_tokens: 10, output_tokens: 5 } }));
    const sharePoint = vi.fn(async () => ({ ok: true, content: 'Saved HR/Draft.md.' }));
    const deps: EngineDeps = {
      appendStep: async () => {}, saveRun: async () => {}, agentIsActive: async () => true, priceOf: () => 0,
      recordUsage: async () => {}, recordDecision: async () => ({ id: 'd' }), sharePoint, fetch: f as unknown as typeof fetch,
    };
    vi.stubGlobal('fetch', f);
    const agent: AgentSnapshot = { id: 'a', name: 'Policy helper', provider: 'anthropic', model: 'claude-sonnet-5-5', instructions: 'Draft policies.', tools: [tool], limits: { maxSteps: 5, maxTokensPerRun: 50_000, maxRunsPerDay: 5, monthlyBudgetUsd: null }, apiKey: 'k', toolSecrets: {}, orgName: 'Highveld Credit (Demo)' };
    const run: RunRecord = { id: 'r', status: 'running', state: { messages: [{ role: 'user', text: 'Draft a leave policy' }], modelCalls: 0, pending: null }, inputTokens: 0, outputTokens: 0, costUsd: 0, output: null, error: null };
    const paused = await advance(agent, run, deps);
    expect(paused.status).toBe('waiting_for_person');
    expect(paused.state.pending).toMatchObject({ kind: 'approval', method: 'write', url: 'https://contoso.sharepoint.com/sites/Policies / Documents / HR/Draft.md' });
    expect(sharePoint).not.toHaveBeenCalled();
    const done = await resume(agent, paused, { kind: 'approve' }, 'u', deps);
    expect(done).toMatchObject({ status: 'completed', output: 'Saved the draft.' });
    expect(sharePoint).toHaveBeenCalledWith(tool, { op: 'write', path: 'HR/Draft.md', content: '# Leave policy draft', replace: false });
    vi.unstubAllGlobals();
  });
});

describe('proving the consenting tenant', () => {
  const idToken = (claims: Record<string, string>) => `x.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.y`;
  it('reads the tenant from the ID token and spots guests', async () => {
    process.env.MS_AGENT_CLIENT_ID = 'agent-app'; process.env.MS_AGENT_CLIENT_SECRET = 'secret';
    const { redeemSignIn } = await import('@/lib/agents/sharepoint');
    const member = vi.fn(async () => Response.json({ id_token: idToken({ tid: TENANT.toUpperCase(), iss: `https://login.microsoftonline.com/${TENANT}/v2.0` }) }));
    expect(await redeemSignIn(TENANT, 'code', 'https://app/cb', member as unknown as typeof fetch)).toEqual({ tid: TENANT, homeTenant: true });
    const guest = vi.fn(async () => Response.json({ id_token: idToken({ tid: TENANT, iss: `https://login.microsoftonline.com/${TENANT}/v2.0`, idp: 'https://sts.windows.net/99999999-0000-0000-0000-000000000000/' }) }));
    expect(await redeemSignIn(TENANT, 'code', 'https://app/cb', guest as unknown as typeof fetch)).toMatchObject({ homeTenant: false });
    const refused = vi.fn(async () => new Response('', { status: 400 }));
    expect(await redeemSignIn(TENANT, 'code', 'https://app/cb', refused as unknown as typeof fetch)).toBeNull();
  });
  it('a typed-in tenant is dropped unless the organisation consented for it', async () => {
    const { pinTenants } = await import('@/lib/agents/view');
    const forged = { ...tool, tenantId: '99999999-0000-0000-0000-000000000000' };
    expect(pinTenants([forged, tool], new Set([TENANT]))).toEqual([{ ...forged, tenantId: null }, tool]);
  });
});
