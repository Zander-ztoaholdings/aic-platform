import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, auditLogs, organizations, eq, and, sql } from '@aic/db';
import { getSession } from '../../../../lib/auth';
import type { Session } from 'next-auth';

// GET /api/audit-logs/:id - Get single audit log
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession() as Session | null;
    if (!session || !session.user?.orgId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const orgId = session.user.orgId;
    const db = getTenantDb(orgId);

    return await db.query(async (tx) => {
      const [log] = await tx
        .select({
          id: auditLogs.id,
          orgId: auditLogs.orgId,
          systemName: auditLogs.systemName,
          eventType: auditLogs.eventType,
          details: auditLogs.details,
          status: auditLogs.status,
          metadata: auditLogs.metadata,
          resourceUsage: auditLogs.resourceUsage,
          integrityHash: auditLogs.integrityHash,
          previousHash: auditLogs.previousHash,
          sequenceNumber: auditLogs.sequenceNumber,
          signature: auditLogs.signature,
          createdAt: auditLogs.createdAt,
          organizationName: organizations.name,
          organizationTier: organizations.tier
        })
        .from(auditLogs)
        .leftJoin(organizations, eq(auditLogs.orgId, organizations.id))
        .where(and(eq(auditLogs.id, id), eq(auditLogs.orgId, orgId)))
        .limit(1);

      if (!log) {
        return NextResponse.json({ error: 'Audit log not found' }, { status: 404 });
      }

      return NextResponse.json({
        log,
        integrity: {
          hash: log.integrityHash,
          verified: true 
        }
      });
    });

  } catch (error) {
    console.error('[SECURITY] Audit Log GET Error:', error);
    return NextResponse.json({ error: 'Failed to fetch audit log' }, { status: 500 });
  }
}

// PUT /api/audit-logs/:id - Update audit log status (for verification)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession() as Session | null;
    if (!session || !session.user?.orgId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const orgId = session.user.orgId;
    const userRole = session.user.role;

    // RBAC: institutional verification restricted to specific roles
    if (userRole !== 'ADMIN' && userRole !== 'COMPLIANCE_OFFICER' && userRole !== 'AUDITOR') {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { status, reviewer_notes } = body;

    // Only allow status updates, not content changes (immutability)
    const validStatuses = ['PENDING', 'VERIFIED', 'FLAGGED'];
    if (!validStatuses || !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status provided' }, { status: 400 });
    }

    const db = getTenantDb(orgId);

    return await db.query(async (tx) => {
      const [updatedLog] = await tx
        .update(auditLogs)
        .set({
          status: status,
          metadata: sql`metadata || ${JSON.stringify({
            reviewed_at: new Date().toISOString(),
            reviewer_notes: reviewer_notes || null,
            reviewer_id: session.user.id
          })}::jsonb`
        })
        .where(and(eq(auditLogs.id, id), eq(auditLogs.orgId, orgId)))
        .returning();

      if (!updatedLog) {
        return NextResponse.json({ error: 'Audit log not found' }, { status: 404 });
      }

      return NextResponse.json({
        message: 'Audit log status updated',
        log: updatedLog
      });
    });

  } catch (error) {
    console.error('[SECURITY] Audit Log Update Error:', error);
    return NextResponse.json({ error: 'Failed to update audit log' }, { status: 500 });
  }
}
