import { NextRequest, NextResponse } from 'next/server';
import { getSystemDb, auditFindings, correctiveActions, auditDocuments, and, eq, desc } from '@aic/db';
import { auth } from '@aic/auth';
import { hasCapability } from '@/lib/rbac';
import { z } from 'zod';

/**
 * Corrective actions: the organisation remediates, AIC judges.
 *
 * That split is the point. POST is the assessed organisation's own action —
 * what it did about a finding. PATCH is AIC's review of it, and is staff-only.
 * The database requires reviewer, timestamp and outcome together, so a review
 * cannot be half-recorded and a finding cannot be closed off the back of one
 * that never happened.
 */

const SubmitSchema = z.object({
  rootCause: z.string().max(4000).optional(),
  actionTaken: z.string().min(10).max(8000),
  evidenceDocumentId: z.string().uuid().optional(),
});

const ReviewSchema = z.object({
  actionId: z.string().uuid(),
  outcome: z.enum(['ACCEPTED', 'REJECTED', 'MORE_INFO_REQUIRED']),
  reviewNotes: z.string().min(10),
});

// POST — the assessed organisation submits its remediation.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ findingId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || !session.user.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { findingId } = await params;
    const data = SubmitSchema.parse(await request.json());
    const db = getSystemDb();

    const [finding] = await db.select().from(auditFindings)
      .where(eq(auditFindings.id, findingId)).limit(1);
    if (!finding) return NextResponse.json({ error: 'Finding not found' }, { status: 404 });

    // Only the organisation the finding was raised against may respond to it.
    const isAicStaff = await hasCapability(session.user.id, 'conduct_assessment');
    if (finding.orgId !== session.user.orgId && !isAicStaff) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (finding.status === 'CLOSED' || finding.status === 'WITHDRAWN') {
      return NextResponse.json({ error: 'Finding is already resolved' }, { status: 409 });
    }

    if (data.evidenceDocumentId) {
      const [doc] = await db.select({ id: auditDocuments.id }).from(auditDocuments)
        .where(and(eq(auditDocuments.id, data.evidenceDocumentId), eq(auditDocuments.orgId, finding.orgId)))
        .limit(1);
      if (!doc) return NextResponse.json({ error: 'Evidence does not belong to that organisation' }, { status: 400 });
    }

    const [action] = await db.insert(correctiveActions).values({
      findingId,
      orgId: finding.orgId,
      rootCause: data.rootCause ?? null,
      actionTaken: data.actionTaken,
      evidenceDocumentId: data.evidenceDocumentId ?? null,
      submittedBy: session.user.id,
    }).returning();

    // The finding now awaits AIC's review rather than the organisation's.
    await db.update(auditFindings)
      .set({ status: 'RESPONSE_SUBMITTED', updatedAt: new Date() })
      .where(eq(auditFindings.id, findingId));

    return NextResponse.json({ correctiveAction: action }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', issues: error.issues }, { status: 400 });
    }
    console.error('[CORRECTIVE_ACTION_POST_ERROR]', error);
    return NextResponse.json({ error: 'Could not submit corrective action' }, { status: 500 });
  }
}

// GET — everyone who can see the finding can see its remediation history.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ findingId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { findingId } = await params;
  const db = getSystemDb();

  const [finding] = await db.select().from(auditFindings)
    .where(eq(auditFindings.id, findingId)).limit(1);
  if (!finding) return NextResponse.json({ error: 'Finding not found' }, { status: 404 });

  const isAicStaff = await hasCapability(session.user.id, 'conduct_assessment');
  if (finding.orgId !== session.user.orgId && !isAicStaff) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const actions = await db.select().from(correctiveActions)
    .where(eq(correctiveActions.findingId, findingId))
    .orderBy(desc(correctiveActions.submittedAt));

  return NextResponse.json({ correctiveActions: actions });
}

// PATCH — AIC reviews a submitted corrective action.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ findingId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAicStaff = await hasCapability(session.user.id, 'conduct_assessment');
  if (!isAicStaff) {
    return NextResponse.json(
      { error: 'Forbidden', message: 'Missing capability: conduct_assessment' },
      { status: 403 }
    );
  }

  try {
    const { findingId } = await params;
    const data = ReviewSchema.parse(await request.json());
    const db = getSystemDb();

    const [action] = await db.select().from(correctiveActions)
      .where(and(eq(correctiveActions.id, data.actionId), eq(correctiveActions.findingId, findingId)))
      .limit(1);
    if (!action) return NextResponse.json({ error: 'Corrective action not found for this finding' }, { status: 404 });
    if (action.reviewedAt) {
      return NextResponse.json({ error: 'This corrective action has already been reviewed' }, { status: 409 });
    }

    const now = new Date();
    const [reviewed] = await db.update(correctiveActions).set({
      reviewedBy: session.user.id,
      reviewedAt: now,
      outcome: data.outcome,
      reviewNotes: data.reviewNotes,
    }).where(eq(correctiveActions.id, data.actionId)).returning();

    // A rejected or incomplete response reopens the finding. Closing it is a
    // separate, deliberate act via PATCH /api/v1/findings/[findingId] — accepting
    // a remediation and declaring the finding closed are not the same decision.
    if (data.outcome !== 'ACCEPTED') {
      await db.update(auditFindings)
        .set({ status: 'OPEN', updatedAt: now })
        .where(eq(auditFindings.id, findingId));
    } else {
      await db.update(auditFindings)
        .set({ status: 'ACCEPTED', updatedAt: now })
        .where(eq(auditFindings.id, findingId));
    }

    return NextResponse.json({ correctiveAction: reviewed });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', issues: error.issues }, { status: 400 });
    }
    console.error('[CORRECTIVE_ACTION_PATCH_ERROR]', error);
    return NextResponse.json({ error: 'Could not review corrective action' }, { status: 500 });
  }
}
