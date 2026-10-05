import { NextRequest, NextResponse } from 'next/server';
import { getSystemDb, auditDocuments, eq } from '@aic/db';
import { adminActor, recordAdminAction } from '@/lib/admin';

const OUTCOMES = ['ACCEPTED', 'REJECTED', 'INSUFFICIENT'] as const;

/**
 * Record an assessor's conclusion on one piece of evidence: who, when, what,
 * and why. The database requires all three of verifier, time and outcome
 * together. A conclusion can be revised, and the revision is on the
 * oversight log with the previous one.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await adminActor('conduct_assessment');
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { outcome?: string; notes?: string };
  const outcome = OUTCOMES.find((o) => o === body.outcome);
  const notes = (body.notes ?? '').trim();
  if (!outcome) return NextResponse.json({ error: 'Choose accepted, rejected or insufficient.' }, { status: 400 });
  if (outcome !== 'ACCEPTED' && notes.length < 10) {
    return NextResponse.json({ error: 'Say what is wrong or missing, so the organisation knows what to file instead.' }, { status: 400 });
  }

  const db = getSystemDb();
  const [doc] = await db.select().from(auditDocuments).where(eq(auditDocuments.id, id)).limit(1);
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const now = new Date();
  await db
    .update(auditDocuments)
    .set({ verificationOutcome: outcome, verificationNotes: notes || null, verifiedBy: actor.id, verifiedAt: now, status: outcome === 'ACCEPTED' ? 'VERIFIED' : 'REJECTED', updatedAt: now })
    .where(eq(auditDocuments.id, id));

  await recordAdminAction({
    actorId: actor.id,
    orgId: doc.orgId,
    targetType: 'ADMIN_EVIDENCE',
    targetId: doc.id,
    previous: { outcome: doc.verificationOutcome, notes: doc.verificationNotes },
    next: { outcome, notes },
    reason: notes || 'Evidence accepted',
  });
  return NextResponse.json({ ok: true });
}
