import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, suppliers, supplierReviews, and, eq } from '@aic/db';
import { orgCaller, guarded } from '@/lib/registers/caller';
import { isUuid } from '@/lib/policy-hash';
import { nextReview } from '@/lib/registers/suppliers';

/** Record a review of a supplier: the outcome, what was checked, and when it is due again. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await orgCaller({ manage: true });
  if ('error' in c) return c.error;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const b = (await request.json().catch(() => ({}))) as { outcome?: unknown; notes?: unknown; documentId?: unknown };
  if (!['approved', 'approved_with_conditions', 'rejected'].includes(b.outcome as string)) return NextResponse.json({ error: 'Choose an outcome.' }, { status: 400 });
  const notes = typeof b.notes === 'string' ? b.notes.trim().slice(0, 4000) : '';
  if (b.outcome !== 'approved' && notes.length < 10) return NextResponse.json({ error: 'Say what the conditions are, or why it was not approved.' }, { status: 400 });
  return guarded('016', async () => {
    const db = getTenantDb(c.orgId);
    const done = await db.query(async (tx) => {
      const [s] = await tx.select().from(suppliers).where(and(eq(suppliers.id, id), eq(suppliers.orgId, c.orgId))).limit(1);
      if (!s) return null;
      const next = nextReview(s.criticality);
      await tx.insert(supplierReviews).values({
        supplierId: id, orgId: c.orgId, outcome: b.outcome as string, notes: notes || null,
        documentId: typeof b.documentId === 'string' && isUuid(b.documentId) ? b.documentId : null, reviewedBy: c.userId, nextReviewAt: next,
      });
      await tx.update(suppliers).set({ nextReviewAt: next, updatedAt: new Date() }).where(eq(suppliers.id, id));
      return next;
    });
    if (!done) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, nextReviewAt: done }, { status: 201 });
  });
}
