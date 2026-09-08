import { NextRequest, NextResponse } from 'next/server';
import { getSystemDb, auditFindings, eq } from '@aic/db';
import { auth } from '@aic/auth';
import { hasCapability } from '@/lib/rbac';
import { z } from 'zod';

/**
 * Closing or withdrawing a finding.
 *
 * The database refuses a CLOSED or WITHDRAWN finding that does not record who
 * closed it and when, so a finding cannot quietly disappear between an audit
 * and a certification decision. Closure notes are required here for the same
 * reason: "why was this considered resolved" has to be answerable later.
 */

const UpdateSchema = z.object({
  status: z.enum(['ACCEPTED', 'CLOSED', 'WITHDRAWN']),
  closureNotes: z.string().min(10, 'Closure notes of at least 10 characters are required'),
});

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
    const data = UpdateSchema.parse(await request.json());
    const db = getSystemDb();

    const [existing] = await db.select().from(auditFindings)
      .where(eq(auditFindings.id, findingId)).limit(1);
    if (!existing) return NextResponse.json({ error: 'Finding not found' }, { status: 404 });

    if (existing.status === 'CLOSED' || existing.status === 'WITHDRAWN') {
      return NextResponse.json({
        error: 'Finding is already resolved',
        message: `This finding was ${existing.status.toLowerCase()} on ${existing.closedAt?.toISOString()}.`,
      }, { status: 409 });
    }

    const terminal = data.status === 'CLOSED' || data.status === 'WITHDRAWN';
    const now = new Date();

    const [updated] = await db.update(auditFindings).set({
      status: data.status,
      closureNotes: data.closureNotes,
      closedAt: terminal ? now : null,
      closedBy: terminal ? session.user.id : null,
      updatedAt: now,
    }).where(eq(auditFindings.id, findingId)).returning();

    return NextResponse.json({ finding: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', issues: error.issues }, { status: 400 });
    }
    console.error('[FINDING_PATCH_ERROR]', error);
    return NextResponse.json({ error: 'Could not update finding' }, { status: 500 });
  }
}
