import { NextResponse } from 'next/server';
import { organizations, auditRequirements, complianceReports, auditLogs, eq, and, desc, getTenantDb, calculateOrganizationIntelligence } from '@aic/db';
import { auth } from '@aic/auth';
import { StatsResponseSchema } from '@aic/types';

export async function GET() {
  try {
    const session = await auth();
    if (!session || !session.user?.orgId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const orgId = session.user.orgId;
    const tdb = getTenantDb(orgId);

    // 1. Execute Core Business Logic (Decoupled & RLS Enforced)
    const intel = await calculateOrganizationIntelligence(orgId);

    // 2. Fetch Additional Telemetry (Using tdb.query to ensure RLS context)
    const result = await tdb.query(async (tx) => {
      const [org] = await tx.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
      
      const requirements = await tx.select().from(auditRequirements).where(eq(auditRequirements.orgId, orgId));
      
      const velocityResults = await tx
        .select({
            month: complianceReports.monthYear,
            score: complianceReports.integrityScore
        })
        .from(complianceReports)
        .where(eq(complianceReports.orgId, orgId))
        .orderBy(desc(complianceReports.monthYear))
        .limit(6);

      const [lastAudit] = await tx
        .select({ createdAt: auditLogs.createdAt })
        .from(auditLogs)
        .where(and(eq(auditLogs.orgId, orgId), eq(auditLogs.status, 'VERIFIED')))
        .orderBy(desc(auditLogs.createdAt))
        .limit(1);

      return { org, requirements, velocityResults, lastAudit };
    });

    const { org, requirements, velocityResults, lastAudit } = result;

    if (!org) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // --- Institutional Data Mapping ---
    
    // 1. Map Velocity Data (integrity progression)
    const velocityData = velocityResults.map(v => ({
      month: v.month,
      score: v.score
    })).reverse();

    // 2. Map Radar Data (framework distribution)
    const categoryStats: Record<string, { total: number; verified: number }> = {};
    requirements.forEach((req) => {
      const cat = req.category || 'General';
      if (!categoryStats[cat]) {
        categoryStats[cat] = { total: 0, verified: 0 };
      }
      categoryStats[cat].total++;
      if (req.status === 'VERIFIED') {
        categoryStats[cat].verified++;
      }
    });

    const finalRadarData = Object.entries(categoryStats).map(([subject, stats]) => ({
      subject,
      A: Math.round((stats.verified / stats.total) * 100) || 0,
      fullMark: 100
    }));

    // Calculate Last Audit and Renewal (Task m34-35)
    const lastAuditAt = lastAudit?.createdAt ? new Date(lastAudit.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Pending';
    const nextRenewalDate = lastAudit?.createdAt 
        ? new Date(new Date(lastAudit.createdAt).setFullYear(new Date(lastAudit.createdAt).getFullYear() + 1)).toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' })
        : 'TBD';

    // --- Institutional Integrity Check (Zod Validation) ---
    const validatedData = StatsResponseSchema.parse({
      orgName: org.name,
      orgId: orgId,
      tier: org.tier || 'TIER_3',
      score: intel.score,
      openIncidents: intel.openIncidents,
      totalRequirements: intel.totalRequirements,
      verifiedRequirements: intel.verifiedRequirements,
      velocityData,
      radarData: finalRadarData,
      lastAuditAt,
      nextRenewalDate,
      status: 'ACTIVE_AUDIT'
    });

    return NextResponse.json(validatedData);
  } catch (error) {
    console.error('[STATS API] Institutional Failure:', error);
    return NextResponse.json({ error: 'Internal intelligence failure' }, { status: 500 });
  }
}
