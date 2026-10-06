import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, modelTrials, eq, desc } from '@aic/db';
import { auth } from '@aic/auth';
import { resolveApiKey } from '@/lib/api-key-auth';
import { validateTrial } from '@/lib/model-trials';

export const dynamic = 'force-dynamic';

/**
 * Model trials. The client's own script (GET ./script) runs a sample of its
 * requests through a cheaper model on its own machine and sends only the
 * counts here, with an aic_live_ key. Prompts and answers never reach AIC.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  const orgId = (session?.user?.orgId as string | undefined) ?? (await resolveApiKey(request));
  if (!orgId) return NextResponse.json({ error: 'Send an AIC API key (Authorization: Bearer aic_live_…) or sign in.' }, { status: 401 });
  const v = validateTrial(await request.json().catch(() => null));
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  try {
    const t = v.value;
    const [row] = await getTenantDb(orgId).query((tx) => tx.insert(modelTrials).values({
      orgId, fromModel: t.fromModel, toModel: t.toModel, method: t.method, samples: t.samples, asGood: t.asGood, worse: t.worse, failed: t.failed,
      fromCostUsd: t.fromCostUsd === null ? null : t.fromCostUsd.toFixed(6), toCostUsd: t.toCostUsd === null ? null : t.toCostUsd.toFixed(6),
      fromLatencyMs: t.fromLatencyMs, toLatencyMs: t.toLatencyMs,
    }).returning({ id: modelTrials.id }));
    return NextResponse.json({ id: row.id }, { status: 201 });
  } catch (e) {
    if (/model_trials/.test((e as Error).message ?? '')) return NextResponse.json({ error: 'AIC is not ready to store trials yet (migration 017).' }, { status: 503 });
    throw e;
  }
}

export async function GET() {
  const session = await auth();
  const orgId = session?.user?.orgId as string | undefined;
  if (!orgId) return NextResponse.json({ error: 'Sign in with an organisation account.' }, { status: 401 });
  try {
    const trials = await getTenantDb(orgId).query((tx) => tx.select().from(modelTrials).where(eq(modelTrials.orgId, orgId)).orderBy(desc(modelTrials.createdAt)).limit(200));
    return NextResponse.json({ trials });
  } catch {
    return NextResponse.json({ trials: [] });
  }
}
