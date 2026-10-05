import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, risks, eq, desc } from '@aic/db';
import { orgCaller, guarded } from '@/lib/registers/caller';
import { validateRisk, heatmap, score, level } from '@/lib/registers/risk';
import { COMMON_CONTROLS } from '@/lib/common-controls';

export const dynamic = 'force-dynamic';
const KNOWN = new Set(COMMON_CONTROLS.map((c) => c.key));

export async function GET() {
  const c = await orgCaller();
  if ('error' in c) return c.error;
  return guarded('016', async () => {
    const rows = await getTenantDb(c.orgId).query((tx) => tx.select().from(risks).where(eq(risks.orgId, c.orgId)).orderBy(desc(risks.updatedAt)));
    const list = rows.map((r) => ({
      ...r, score: score(r.likelihood, r.impact), level: level(score(r.likelihood, r.impact)),
      residualScore: r.residualLikelihood && r.residualImpact ? score(r.residualLikelihood, r.residualImpact) : null,
      overdue: r.status !== 'closed' && !!r.reviewAt && new Date(r.reviewAt).getTime() < Date.now(),
    })).sort((a, b) => (a.status === 'closed' ? 1 : 0) - (b.status === 'closed' ? 1 : 0) || b.score - a.score);
    return NextResponse.json({
      risks: list, heatmap: heatmap(rows), canManage: c.canManage,
      controls: COMMON_CONTROLS.map(({ key, title, area }) => ({ key, title, area })),
    });
  });
}

export async function POST(request: NextRequest) {
  const c = await orgCaller({ manage: true });
  if ('error' in c) return c.error;
  const v = validateRisk(await request.json().catch(() => null), KNOWN);
  if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 });
  return guarded('016', async () => {
    const [row] = await getTenantDb(c.orgId).query((tx) => tx.insert(risks).values({ orgId: c.orgId, ...v.value, createdBy: c.userId }).returning({ id: risks.id }));
    return NextResponse.json({ id: row.id }, { status: 201 });
  });
}
