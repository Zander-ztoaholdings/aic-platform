import { NextRequest, NextResponse } from 'next/server';
import { isUuid } from '@/lib/policy-hash';
import { orgCaller, guarded } from '@/lib/registers/caller';
import { loadAgent, getRun, runSteps, actOnRun, RunRefused } from '@/lib/agents/runtime';
import { verifyChain, type RunState } from '@/lib/agents/engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
type Ctx = { params: Promise<{ id: string; runId: string }> };

/** One run, every step, and whether its chain is intact. */
export async function GET(_r: NextRequest, { params }: Ctx) {
  const { id, runId } = await params;
  const c = await orgCaller();
  if ('error' in c) return c.error;
  if (!isUuid(id) || !isUuid(runId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return guarded('017', async () => {
    const run = await getRun(c.orgId, runId);
    if (!run || run.agentId !== id) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const steps = await runSteps(c.orgId, runId);
    const pending = (run.state as RunState).pending ?? null;
    const { state: _state, ...rest } = run;
    void _state;
    return NextResponse.json({
      run: { ...rest, pending: pending ? (pending.kind === 'approval' ? { kind: 'approval', tool: pending.call.name, method: pending.method, url: pending.url, body: pending.body ?? null } : { kind: 'question', tool: pending.call.name, question: pending.question }) : null },
      steps, chainIntact: verifyChain(steps), canManage: c.canManage,
    });
  });
}

/** { "action": "approve" | "deny" | "answer" | "stop", "text"?: string } */
export async function POST(request: NextRequest, { params }: Ctx) {
  const { id, runId } = await params;
  const c = await orgCaller({ manage: true });
  if ('error' in c) return c.error;
  if (!isUuid(id) || !isUuid(runId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const b = (await request.json().catch(() => ({}))) as { action?: string; text?: unknown };
  const text = typeof b.text === 'string' ? b.text.trim() : '';
  const action = b.action === 'approve' ? { kind: 'approve' as const }
    : b.action === 'deny' ? { kind: 'deny' as const, reason: text || undefined }
    : b.action === 'stop' ? { kind: 'stop' as const }
    : b.action === 'answer' && text ? { kind: 'answer' as const, text } : null;
  if (!action) return NextResponse.json({ error: b.action === 'answer' ? 'Write an answer first.' : 'Unknown action.' }, { status: 400 });
  return guarded('017', async () => {
    const a = await loadAgent(c.orgId, id);
    const run = await getRun(c.orgId, runId);
    if (!a || !run || run.agentId !== id) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    try {
      const out = await actOnRun(c.orgId, a, run, action, c.userId);
      return NextResponse.json({ run: { id: out.id, status: out.status, output: out.output, error: out.error } });
    } catch (e) {
      if (e instanceof RunRefused) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  });
}
