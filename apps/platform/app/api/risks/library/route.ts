import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, risks, eq } from '@aic/db';
import { orgCaller, guarded } from '@/lib/registers/caller';
import { nextReviewAt, score } from '@/lib/registers/risk';
import { LIBRARY_BY_KEY } from '@/lib/registers/risk-library';
import { loadTracking, saveTracking, recordEvents } from '@/lib/registers/risk-observe';

export const dynamic = 'force-dynamic';

/** Add risks from AIC's library. Body: { keys: string[] }. Templates already open on the register are skipped. */
export async function POST(request: NextRequest) {
  const c = await orgCaller({ manage: true });
  if ('error' in c) return c.error;
  const b = (await request.json().catch(() => ({}))) as { keys?: unknown };
  const keys = Array.isArray(b.keys) ? [...new Set(b.keys.filter((k): k is string => typeof k === 'string' && !!LIBRARY_BY_KEY[k]))].slice(0, 40) : [];
  if (!keys.length) return NextResponse.json({ error: 'Choose at least one risk from the library.' }, { status: 400 });
  return guarded('016', async () => {
    const tracking = await loadTracking(c.orgId);
    const db = getTenantDb(c.orgId);
    const openIds = new Set((await db.query((tx) => tx.select({ id: risks.id, status: risks.status }).from(risks).where(eq(risks.orgId, c.orgId)))).filter((r) => r.status !== 'closed').map((r) => r.id));
    const already = new Set([...(tracking?.entries() ?? [])].filter(([id, t]) => openIds.has(id) && t.libraryKey).map(([, t]) => t.libraryKey as string));
    const todo = keys.filter((k) => !already.has(k));
    const added: string[] = [];
    for (const k of todo) {
      const t = LIBRARY_BY_KEY[k];
      const [row] = await db.query((tx) => tx.insert(risks).values({
        orgId: c.orgId, title: t.title, description: t.description, category: t.category, likelihood: t.likelihood, impact: t.impact,
        treatment: t.treatment, treatmentPlan: t.treatmentPlan, controls: t.controls, status: 'open',
        reviewAt: nextReviewAt(score(t.likelihood, t.impact)), createdBy: c.userId,
      }).returning({ id: risks.id }));
      await saveTracking(c.orgId, row.id, { source: 'library', libraryKey: k });
      await recordEvents(c.orgId, c.userId, [{ riskId: row.id, kind: 'created', detail: { title: t.title, likelihood: t.likelihood, impact: t.impact, score: score(t.likelihood, t.impact), source: 'library', libraryKey: k } }]);
      added.push(row.id);
    }
    return NextResponse.json({ added: added.length, skipped: keys.length - todo.length, ids: added }, { status: 201 });
  });
}
