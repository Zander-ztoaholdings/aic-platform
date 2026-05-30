import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, getSystemDb, organizations, auditLogs, eq, sql } from '@aic/db';
import { getSession } from '../../../../lib/auth';
import type { Session } from 'next-auth';

// GET /api/organizations/:id - Get organization details
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

    // Strict multi-tenant isolation
    if (session.user.orgId !== id && !session.user.isSuperAdmin) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const isSuperAdmin = session.user.isSuperAdmin;
    // [SECURITY] getSystemDb() used for SuperAdmin to access organization data.
    // getTenantDb() used for regular users to enforce tenant isolation.
    
    let org;
    let stats;

    if (isSuperAdmin) {
      const db = getSystemDb();
      [org] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
      if (org) {
        [stats] = await db.select({
          total: sql<number>`count(*)`,
          verified: sql<number>`count(*) filter (where status = 'VERIFIED')`,
          flagged: sql<number>`count(*) filter (where status = 'FLAGGED')`,
          pending: sql<number>`count(*) filter (where status = 'PENDING')`
        })
        .from(auditLogs)
        .where(eq(auditLogs.orgId, id));
      }
    } else {
      const db = getTenantDb(session.user.orgId);
      const data = await db.query(async (tx) => {
        const [o] = await tx.select().from(organizations).where(eq(organizations.id, id)).limit(1);
        let s = null;
        if (o) {
          [s] = await tx.select({
            total: sql<number>`count(*)`,
            verified: sql<number>`count(*) filter (where status = 'VERIFIED')`,
            flagged: sql<number>`count(*) filter (where status = 'FLAGGED')`,
            pending: sql<number>`count(*) filter (where status = 'PENDING')`
          })
          .from(auditLogs)
          .where(eq(auditLogs.orgId, id));
        }
        return { o, s };
      });
      org = data.o;
      stats = data.s;
    }

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json({
      organization: org,
      audit_stats: stats
    });

  } catch (error) {
    console.error('[SECURITY] Organization GET Error:', error);
    return NextResponse.json({ error: 'Failed to fetch organization' }, { status: 500 });
  }
}

// PUT /api/organizations/:id - Update organization
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

    if ((session.user.orgId !== id || session.user.role !== 'ADMIN') && !session.user.isSuperAdmin) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { name, tier } = body;

    // Task M15: Institutional Security - integrity_score is READ-ONLY for users
    // It is only updated by the Intelligence Service.

    if (name === undefined && tier === undefined) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const isSuperAdmin = session.user.isSuperAdmin;
    // [SECURITY] getSystemDb() used for SuperAdmin to access organization data.
    // getTenantDb() used for regular users to enforce tenant isolation.
    
    let updatedOrg;

    if (isSuperAdmin) {
      const db = getSystemDb();
      [updatedOrg] = await db
        .update(organizations)
        .set({ 
          name: name,
          tier: tier
        })
        .where(eq(organizations.id, id))
        .returning();
    } else {
      const db = getTenantDb(session.user.orgId);
      updatedOrg = await db.query(async (tx) => {
        const [o] = await tx
          .update(organizations)
          .set({ 
            name: name,
            tier: tier
          })
          .where(eq(organizations.id, id))
          .returning();
        return o;
      });
    }

    if (!updatedOrg) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json({
      message: 'Organization updated successfully',
      organization: updatedOrg
    });

  } catch (error) {
    console.error('[SECURITY] Organization Update Error:', error);
    return NextResponse.json({ error: 'Failed to update organization' }, { status: 500 });
  }
}
