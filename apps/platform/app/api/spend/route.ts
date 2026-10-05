import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, getSystemDb, llmUsageRecords, organizations, eq, and, sql } from '@aic/db';
import { policyCaller } from '@/lib/policies';
import { summariseSpend, type UsageRow } from '@/lib/spend';

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
  return NextResponse.json({ ...summariseSpend(rows as UsageRow[], new Date(), budget), canManage: c.canManage });
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
