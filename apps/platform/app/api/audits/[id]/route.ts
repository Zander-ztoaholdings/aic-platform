import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@aic/auth';
import { getSystemDb, scheduledAudits, eq } from '@aic/db';
import { hasCapability } from '@/lib/rbac';

const VALID_STATUSES = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

/** Status transitions for one scheduled audit (start / complete / cancel). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const authorized = await hasCapability(session.user.id, 'access_admin_tools');
  if (!authorized) {
    return NextResponse.json(
      { error: 'Forbidden', message: 'Missing capability: access_admin_tools' },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { status, notes, auditor_id } = body ?? {};

    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: `status must be one of ${VALID_STATUSES.join(', ')}` }, { status: 400 });
    }

    const db = getSystemDb();
    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (status !== undefined) update.status = status;
    if (notes !== undefined) update.notes = notes;
    if (auditor_id !== undefined) update.auditorId = auditor_id;

    const [row] = await db
      .update(scheduledAudits)
      .set(update)
      .where(eq(scheduledAudits.id, id))
      .returning();

    if (!row) return NextResponse.json({ error: 'Scheduled audit not found' }, { status: 404 });

    return NextResponse.json({ audit: row });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to update scheduled audit' }, { status: 500 });
  }
}
