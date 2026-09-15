import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@aic/auth';
import { getSystemDb, scheduledAudits, organizations, users, eq, desc } from '@aic/db';
import { hasCapability } from '@/lib/rbac';

/**
 * AIC's institutional audit schedule (app/(modules)/admin/audits, and the
 * "Execute New Audit" quick action in AdminShell).
 *
 * Cross-organisation by design - this is AIC's own registry of which org
 * gets audited when, not a client-facing endpoint - so it reads through
 * getSystemDb() rather than a tenant-scoped connection, the same choice
 * /api/v1/admin/organizations makes for the same reason.
 *
 * `findings` is deliberately not joined in here. audit_findings rows carry
 * an orgId but no scheduled_audit_id, so there is no correct join from one
 * scheduled audit to "the findings that came out of it" - only a guess by
 * date proximity, which would look precise and be wrong. The admin UI
 * already treats a missing count as zero; better an honest zero than a
 * fabricated relationship.
 */
export async function GET() {
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
    const db = getSystemDb();
    const rows = await db
      .select({
        id: scheduledAudits.id,
        org_id: scheduledAudits.orgId,
        org_name: organizations.name,
        auditor_id: scheduledAudits.auditorId,
        auditor_name: users.name,
        scheduled_at: scheduledAudits.scheduledAt,
        status: scheduledAudits.status,
        notes: scheduledAudits.notes,
        created_at: scheduledAudits.createdAt,
        updated_at: scheduledAudits.updatedAt,
      })
      .from(scheduledAudits)
      .leftJoin(organizations, eq(scheduledAudits.orgId, organizations.id))
      .leftJoin(users, eq(scheduledAudits.auditorId, users.id))
      .orderBy(desc(scheduledAudits.scheduledAt));

    return NextResponse.json({ audits: rows });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch scheduled audits' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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
    const body = await request.json();
    const { org_id, auditor_id, scheduled_at, notes } = body ?? {};

    if (!org_id || typeof org_id !== 'string') {
      return NextResponse.json({ error: 'org_id is required' }, { status: 400 });
    }
    if (!scheduled_at || Number.isNaN(new Date(scheduled_at).getTime())) {
      return NextResponse.json({ error: 'scheduled_at must be a valid date' }, { status: 400 });
    }

    const db = getSystemDb();
    const [row] = await db
      .insert(scheduledAudits)
      .values({
        orgId: org_id,
        auditorId: auditor_id || null,
        scheduledAt: new Date(scheduled_at),
        notes: notes || null,
      })
      .returning();

    return NextResponse.json({ audit: row }, { status: 201 });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to schedule audit' }, { status: 500 });
  }
}
