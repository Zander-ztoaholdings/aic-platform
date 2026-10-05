import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, decisionRecords, hitlLogs, users, eq, and } from '@aic/db';
import { auth } from '@aic/auth';
import { isUuid } from '@/lib/policy-hash';
import { isExpired, publicReview } from '@/lib/decision-review';
import { sendDecisionCallback } from '@/lib/decision-callback';

/**
 * A named person approves or overrides a held decision. Session only: an API
 * key identifies a system, and the whole point is that a person decided.
 * Body: { action: 'approve' | 'override', note?: string, outcome?: unknown }
 * An override needs a reason (at least 10 characters) and the outcome that
 * replaces the system's.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const orgId = session?.user?.orgId as string | undefined;
  const userId = session?.user?.id as string | undefined;
  if (!orgId || !userId) return NextResponse.json({ error: 'Sign in to review a decision.' }, { status: 401 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const b = (await request.json().catch(() => ({}))) as { action?: unknown; note?: unknown; outcome?: unknown };
  const note = typeof b.note === 'string' ? b.note.trim().slice(0, 4000) : '';
  if (b.action !== 'approve' && b.action !== 'override') return NextResponse.json({ error: 'action must be approve or override' }, { status: 400 });
  if (b.action === 'override') {
    if (note.length < 10) return NextResponse.json({ error: 'Give the reason for the override (at least 10 characters). It is recorded with your name.' }, { status: 400 });
    if (b.outcome === undefined || b.outcome === null || b.outcome === '') return NextResponse.json({ error: 'Say what the outcome is instead.' }, { status: 400 });
  }

  const db = getTenantDb(orgId);
  const result = await db.query(async (tx) => {
    const [d] = await tx.select().from(decisionRecords).where(and(eq(decisionRecords.id, id), eq(decisionRecords.orgId, orgId))).limit(1);
    if (!d) return { error: 'Not found', status: 404 } as const;
    if (isExpired(d.reviewStatus, d.reviewDueAt)) {
      await tx.update(decisionRecords).set({ reviewStatus: 'expired' }).where(eq(decisionRecords.id, id));
      return { error: 'The review deadline for this decision has passed. The sending system has been told it expired.', status: 409 } as const;
    }
    if (d.reviewStatus !== 'pending') return { error: 'This decision is not waiting for review.', status: 409 } as const;

    const now = new Date();
    const override = b.action === 'override';
    const [updated] = await tx.update(decisionRecords).set({
      reviewStatus: override ? 'overridden' : 'approved',
      reviewedBy: userId, reviewedAt: now, reviewNote: note || null,
      ...(override ? { finalOutcome: b.outcome as object, isHumanOverride: true, overrideReason: note, overriddenBy: userId } : {}),
    }).where(and(eq(decisionRecords.id, id), eq(decisionRecords.reviewStatus, 'pending'))).returning();
    if (!updated) return { error: 'Someone else reviewed this decision first.', status: 409 } as const;

    await tx.insert(hitlLogs).values({
      orgId, actorId: userId, targetType: override ? 'DECISION_OVERRIDE' : 'DECISION_REVIEW', targetId: id,
      previousValue: d.outcome as object, newValue: (override ? b.outcome : d.outcome) as object,
      overrideReason: override ? note : (note || 'Approved on review'), integrityHash: d.integrityHash,
    });
    const [me] = await tx.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
    return { decision: updated, reviewerName: me?.name ?? null } as const;
  });
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const d = result.decision;
  const payload = publicReview({ ...d, reviewerName: result.reviewerName });
  let callback: string | null = null;
  if (d.callbackUrl) {
    callback = await sendDecisionCallback(orgId, d.callbackUrl, payload);
    await db.query((tx) => tx.update(decisionRecords).set({ callbackStatus: callback }).where(eq(decisionRecords.id, id)));
  }
  return NextResponse.json({ ...payload, callback });
}
