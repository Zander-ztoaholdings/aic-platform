import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, getSystemDb, llmUsageRecords, organizations, eq, and, sql } from '@aic/db';
import { policyCaller } from '@/lib/policies';
import { summariseSpend, type UsageRow } from '@/lib/spend';
import { adviseModels, totalSaving, type ModelUsage } from '@/lib/spend-switch';
import { PRICES_AS_OF, PRICE_SOURCES } from '@/lib/ai-prices';
import { modelTrials, desc } from '@aic/db';
import { latestPerPair, trialVerdict, suggestJudge, scriptSupports } from '@/lib/model-trials';

export const dynamic = 'force-dynamic';

/** AI spend for the signed-in organisation: 60 days of usage, summarised. */
export async function GET() {
  const c = await policyCaller();
  if ('error' in c) return c.error;
  const rows = await getTenantDb(c.orgId).query((tx) =>
    tx.select({
      provider: llmUsageRecords.provider, model: llmUsageRecords.model, systemName: llmUsageRecords.systemName,
      periodStart: llmUsageRecords.periodStart, requests: llmUsageRecords.requests,
      inputTokens: llmUsageRecords.inputTokens, outputTokens: llmUsageRecords.outputTokens, costUsd: llmUsageRecords.costUsd,
    }).from(llmUsageRecords)
      .where(and(eq(llmUsageRecords.orgId, c.orgId), sql`${llmUsageRecords.periodStart} > now() - interval '62 days'`))
  );
  const [org] = await getSystemDb().select({ budget: organizations.aiMonthlyBudgetUsd }).from(organizations).where(eq(organizations.id, c.orgId)).limit(1);
  const budget = org?.budget ? Number(org.budget) : null;
  const now = new Date();
  const summary = summariseSpend(rows as UsageRow[], now, budget);

  // Switch advice works on the last 30 days of tokens, per model.
  const byModel = new Map<string, ModelUsage>();
  for (const r of rows) {
    if (!r.model || new Date(r.periodStart).getTime() < now.getTime() - 30 * 86_400_000) continue;
    const u = byModel.get(r.model) ?? { model: r.model, provider: r.provider, cost: 0, requests: 0, inputTokens: 0, outputTokens: 0 };
    u.cost += Number(r.costUsd ?? 0) || 0; u.requests += Number(r.requests ?? 0) || 0;
    u.inputTokens += Number(r.inputTokens ?? 0) || 0; u.outputTokens += Number(r.outputTokens ?? 0) || 0;
    byModel.set(r.model, u);
  }
  const advice = adviseModels([...byModel.values()], now);
  // Results of the client's own trials (lib/model-trials), newest per pair. Before migration 017 there are none.
  let trials: { fromModel: string; toModel: string; samples: number; asGood: number; worse: number; failed: number; createdAt: Date; verdict: string; sentence: string }[] = [];
  try {
    const rows = await getTenantDb(c.orgId).query((tx) => tx.select().from(modelTrials).where(eq(modelTrials.orgId, c.orgId)).orderBy(desc(modelTrials.createdAt)).limit(200));
    trials = latestPerPair(rows).map((t) => ({ fromModel: t.fromModel, toModel: t.toModel, samples: t.samples, asGood: t.asGood, worse: t.worse, failed: t.failed, createdAt: t.createdAt, ...trialVerdict(t) }));
  } catch { /* 017 not applied */ }
  const judges = Object.fromEntries(advice.flatMap((a) => a.options.map((o) => [`${a.model}|${o.to}`, scriptSupports(a.model) && scriptSupports(o.to) ? suggestJudge(a.model, o.to) : null])));
  const advised = new Set(advice.filter((a) => a.options.length).map((a) => a.model));
  return NextResponse.json({
    ...summary,
    // The switch advice below says the same thing with figures, so the older generic flag is dropped for those models.
    flags: summary.flags.filter((f) => !(f.kind === 'premium_short' && [...advised].some((m) => f.title.startsWith(m + ' ')))),
    switches: { advice, total: totalSaving(advice), asOf: PRICES_AS_OF, sources: PRICE_SOURCES, trials, judges },
    canManage: c.canManage,
  });
}

/** Set or clear the monthly AI budget (organisation admins). Body: { budgetUsd: number | null } */
export async function PATCH(request: NextRequest) {
  const c = await policyCaller({ manage: true });
  if ('error' in c) return c.error;
  const body = (await request.json().catch(() => ({}))) as { budgetUsd?: unknown };
  const v = body.budgetUsd;
  if (v !== null && (typeof v !== 'number' || !Number.isFinite(v) || v <= 0 || v > 10_000_000)) {
    return NextResponse.json({ error: 'Give a monthly budget in US dollars, or clear it.' }, { status: 400 });
  }
  await getSystemDb().update(organizations).set({ aiMonthlyBudgetUsd: v === null ? null : v.toFixed(2) }).where(eq(organizations.id, c.orgId));
  return NextResponse.json({ ok: true });
}
