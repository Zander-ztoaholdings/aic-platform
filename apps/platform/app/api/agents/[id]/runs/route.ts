import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@aic/auth';
import { getTenantDb, agentRuns, eq, and, desc } from '@aic/db';
import { isUuid } from '@/lib/policy-hash';
import { guarded } from '@/lib/registers/caller';
import { canManageCompliance } from '@/lib/roles';
import { resolveApiKey } from '@/lib/api-key-auth';
import { loadAgent, startRun, RunRefused } from '@/lib/agents/runtime';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
type Ctx = { params: Promise<{ id: string }> };

/** Signed-in member, or an AIC API key for runs started from the client's own systems. */
async function caller(request: NextRequest, write: boolean) {
  const session = await auth();
  const u = session?.user as { id?: string; orgId?: string; role?: string } | undefined;
  if (u?.id && u.orgId) {
    if (write && !canManageCompliance(u.role)) return { error: NextResponse.json({ error: 'Your role cannot run agents.' }, { status: 403 }) } as const;
    return { orgId: u.orgId, userId: u.id, via: 'session' as const };
  }
  const orgId = await resolveApiKey(request);
  if (orgId) return { orgId, userId: null, via: 'api_key' as const };
  return { error: NextResponse.json({ error: 'Sign in, or send an AIC API key (Authorization: Bearer aic_live_…).' }, { status: 401 }) } as const;
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const c = await caller(request, false);
  if ('error' in c) return c.error;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return guarded('017', async () => {
    const runs = await getTenantDb(c.orgId).query((tx) => tx.select({
      id: agentRuns.id, status: agentRuns.status, trigger: agentRuns.trigger, input: agentRuns.input, output: agentRuns.output, error: agentRuns.error,
      steps: agentRuns.steps, inputTokens: agentRuns.inputTokens, outputTokens: agentRuns.outputTokens, costUsd: agentRuns.costUsd,
      agentVersion: agentRuns.agentVersion, startedAt: agentRuns.startedAt, finishedAt: agentRuns.finishedAt,
    }).from(agentRuns).where(and(eq(agentRuns.agentId, id), eq(agentRuns.orgId, c.orgId))).orderBy(desc(agentRuns.startedAt)).limit(100));
    return NextResponse.json({ runs });
  });
}

/** Starts a run: { "input": "what to do" }. Answers when the run finishes or waits for a person. */
export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const c = await caller(request, true);
  if ('error' in c) return c.error;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as { input?: unknown };
  return guarded('017', async () => {
    const a = await loadAgent(c.orgId, id);
    if (!a || a.status === 'archived') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    try {
      const run = await startRun(c.orgId, a, typeof body.input === 'string' ? body.input : '', { via: c.via, userId: c.userId });
      return NextResponse.json({ run: { id: run.id, status: run.status, output: run.output, error: run.error, steps: run.steps, costUsd: run.costUsd } }, { status: 201 });
    } catch (e) {
      if (e instanceof RunRefused) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  });
}
