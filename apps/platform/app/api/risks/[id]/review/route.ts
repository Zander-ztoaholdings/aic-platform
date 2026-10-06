import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, risks, and, eq } from '@aic/db';
import { orgCaller, guarded } from '@/lib/registers/caller';
import { current, nextReviewAt, reviewMonths } from '@/lib/registers/risk';
import { recordEvents } from '@/lib/registers/risk-observe';
import { isUuid } from '@/lib/policy-hash';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Mark a risk reviewed: the next review date follows from the score as
 * recorded (high and critical every 3 months, medium 6, low 12), and the
 * review goes into the risk's history with the reviewer's note.
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const c = await orgCaller({ manage: true });
  if ('error' in c) return c.error;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const b = (await request.json().catch(() => ({}))) as { note?: unknown };
  const note = typeof b.note === 'string' && b.note.trim() ? b.note.trim().slice(0, 2000) : null;
  return guarded('016', async () => {
    const db = getTenantDb(c.orgId);
    const [r] = await db.query((tx) => tx.select().from(risks).where(and(eq(risks.id, id), eq(risks.orgId, c.orgId))).limit(1));
    if (!r) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (r.status === 'closed') return NextResponse.json({ error: 'This risk is closed. Reopen it to review it.' }, { status: 400 });
    const s = current(r, 0).score;
    const next = nextReviewAt(s);
    await db.query((tx) => tx.update(risks).set({ reviewAt: next, updatedAt: new Date() }).where(and(eq(risks.id, id), eq(risks.orgId, c.orgId))));
    await recordEvents(c.orgId, c.userId, [{ riskId: id, kind: 'reviewed', detail: { score: s, months: reviewMonths(s), next: next.toISOString().slice(0, 10), previous: r.reviewAt ? new Date(r.reviewAt).toISOString().slice(0, 10) : null, note, by: c.name } }]);
    return NextResponse.json({ ok: true, reviewAt: next.toISOString() });
  });
}
