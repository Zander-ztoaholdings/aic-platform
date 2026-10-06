import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, agents, EncryptionService, eq, and } from '@aic/db';
import { orgCaller, guarded } from '@/lib/registers/caller';
import { isUuid } from '@/lib/policy-hash';
import { cleanAgent, readinessProblems, TOOLS_NOTICE, type AgentTool } from '@/lib/agents/config';
import { loadAgent, readToolSecrets } from '@/lib/agents/runtime';
import { publicAgent, agentChoices, linksBelong } from '@/lib/agents/view';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_r: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const c = await orgCaller();
  if ('error' in c) return c.error;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return guarded('017', async () => {
    const a = await loadAgent(c.orgId, id);
    if (!a || a.status === 'archived') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ agent: publicAgent(a), notice: TOOLS_NOTICE, canManage: c.canManage, encryption: EncryptionService.isConfigured(), ...(await agentChoices(c.orgId)) });
  });
}

/**
 * Edit an agent. Any of: the editable fields (as for create), `modelKey`,
 * `toolSecrets` ({ tool: { Header: value } }; an empty value removes it) and
 * `status` (active, paused or draft). Changing what the agent does raises its
 * version, so each run records which version it ran.
 */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const c = await orgCaller({ manage: true });
  if ('error' in c) return c.error;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  return guarded('017', async () => {
    const a = await loadAgent(c.orgId, id);
    if (!a || a.status === 'archived') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const set: Partial<typeof agents.$inferInsert> = { updatedAt: new Date() };
    let next = { instructions: a.instructions, modelKeyHint: a.modelKeyHint, ownerUserId: a.ownerUserId, tools: (a.tools as AgentTool[]) ?? [], aiSystemId: a.aiSystemId };

    const editsConfig = ['name', 'purpose', 'provider', 'model', 'instructions', 'tools', 'limits', 'aiSystemId', 'ownerUserId'].some((k) => k in body);
    if (editsConfig) {
      const v = cleanAgent({ name: a.name, purpose: a.purpose, provider: a.provider, model: a.model, instructions: a.instructions, tools: a.tools, limits: a.limits, aiSystemId: a.aiSystemId, ownerUserId: a.ownerUserId, ...body });
      if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 });
      const bad = await linksBelong(c.orgId, v.value.ownerUserId, v.value.aiSystemId);
      if (bad) return NextResponse.json({ error: bad }, { status: 400 });
      Object.assign(set, v.value, { version: a.version + 1 });
      next = { ...next, instructions: v.value.instructions, ownerUserId: v.value.ownerUserId, tools: v.value.tools, aiSystemId: v.value.aiSystemId };
      if (v.value.provider !== a.provider && !('modelKey' in body)) { set.modelKeyCiphertext = null; set.modelKeyHint = null; next.modelKeyHint = null; }
    }

    const wantsSecret = ('modelKey' in body && body.modelKey) || 'toolSecrets' in body;
    if (wantsSecret && !EncryptionService.isConfigured()) return NextResponse.json({ error: 'This AIC server cannot store keys yet (no encryption key is set). AIC has been told.' }, { status: 503 });
    if (typeof body.modelKey === 'string' && body.modelKey.trim()) {
      const key = body.modelKey.trim();
      if (key.length < 20 || key.length > 400 || /\s/.test(key)) return NextResponse.json({ error: 'That does not look like a model key.' }, { status: 400 });
      set.modelKeyCiphertext = EncryptionService.encrypt(key);
      set.modelKeyHint = `…${key.slice(-4)}`;
      next.modelKeyHint = set.modelKeyHint;
    }
    if (body.toolSecrets && typeof body.toolSecrets === 'object') {
      const current = readToolSecrets(a);
      const tools = next.tools;
      for (const [tool, headers] of Object.entries(body.toolSecrets as Record<string, Record<string, unknown>>)) {
        const t = tools.find((x) => x.name === tool);
        if (t?.kind !== 'http') continue;
        for (const [h, val] of Object.entries(headers ?? {})) {
          if (!t.secretHeaders.includes(h)) continue;
          const s = typeof val === 'string' ? val.trim().slice(0, 2000) : '';
          current[tool] = { ...(current[tool] ?? {}) };
          if (s) current[tool][h] = s; else delete current[tool][h];
        }
      }
      // Drop secrets for tools or headers that no longer exist.
      for (const k of Object.keys(current)) {
        const t = tools.find((x) => x.name === k);
        if (t?.kind !== 'http') delete current[k];
        else for (const h of Object.keys(current[k])) if (!t.secretHeaders.includes(h)) delete current[k][h];
      }
      set.toolSecretsCiphertext = Object.keys(current).length ? EncryptionService.encrypt(JSON.stringify(current)) : null;
    }

    if ('status' in body) {
      const s = String(body.status);
      if (!['active', 'paused', 'draft'].includes(s)) return NextResponse.json({ error: 'Unknown status.' }, { status: 400 });
      if (s === 'active') {
        const problems = readinessProblems(next);
        if (problems.length) return NextResponse.json({ error: problems[0], problems }, { status: 409 });
      }
      set.status = s;
    }

    const [row] = await getTenantDb(c.orgId).query((tx) => tx.update(agents).set(set).where(and(eq(agents.id, id), eq(agents.orgId, c.orgId))).returning());
    return NextResponse.json({ agent: publicAgent(row) });
  });
}

/** Archives the agent. Its runs and their chains are kept. */
export async function DELETE(_r: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const c = await orgCaller({ manage: true });
  if ('error' in c) return c.error;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return guarded('017', async () => {
    await getTenantDb(c.orgId).query((tx) => tx.update(agents).set({ status: 'archived', modelKeyCiphertext: null, toolSecretsCiphertext: null, updatedAt: new Date() }).where(and(eq(agents.id, id), eq(agents.orgId, c.orgId))));
    return NextResponse.json({ ok: true });
  });
}
