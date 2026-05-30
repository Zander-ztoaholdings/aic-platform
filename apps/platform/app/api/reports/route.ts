import { NextResponse } from 'next/server';
import { getTenantDb, complianceReports, organizations, incidents, eq, desc, sql, and } from '@aic/db';
import { getSession } from '../../../lib/auth';
import type { Session } from 'next-auth';

export async function GET() {
  try {
    const session = await getSession() as Session | null;
    if (!session || !session.user?.orgId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const orgId = session.user.orgId;
    const db = getTenantDb(orgId);

    return await db.query(async (tx) => {
      const result = await tx
        .select()
        .from(complianceReports)
        .where(eq(complianceReports.orgId, orgId))
        .orderBy(desc(complianceReports.createdAt));

      return NextResponse.json({
          reports: result
      });
    });
  } catch (error) {
    console.error('[SECURITY] Reports GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST() {
    try {
        const session = await getSession() as Session | null;
        if (!session || !session.user?.orgId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const orgId = session.user.orgId;
        const db = getTenantDb(orgId);

        return await db.query(async (tx) => {
          // 1. Fetch current score and findings
          const [org] = await tx.select({ integrityScore: organizations.integrityScore }).from(organizations).where(eq(organizations.id, orgId)).limit(1);
          const [incidentCount] = await tx.select({ count: sql<number>`count(*)` }).from(incidents).where(and(eq(incidents.orgId, orgId), eq(incidents.status, 'OPEN')));
          
          if (!org) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
          }

          const score = org.integrityScore || 0;
          const findings = Number(incidentCount?.count || 0);
          const monthYear = new Date().toLocaleString('default', { month: 'short', year: 'numeric' });

          // 2. Insert new report snapshot
          const [newReport] = await tx.insert(complianceReports).values({
            orgId,
            monthYear,
            integrityScore: score,
            auditStatus: score >= 80 ? 'COMPLIANT' : 'REMEDIATION_REQUIRED',
            findingsCount: findings
          }).returning();

          return NextResponse.json({ success: true, report: newReport });
        });

    } catch (error) {
        console.error('[SECURITY] Report Generation Error:', error);
        return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
    }
}