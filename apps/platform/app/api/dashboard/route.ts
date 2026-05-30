import { NextResponse } from 'next/server';
import { getTenantDb, organizations, auditLogs, models, correctionRequests, eq, and, sql, desc } from '@aic/db';
import { getSession } from '../../../lib/auth';
import type { Session } from 'next-auth';

// GET /api/dashboard - Comprehensive dashboard data
export async function GET() {
  try {
    const session = await getSession() as Session | null;
    if (!session || !session.user?.orgId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const orgId = session.user.orgId;
    const db = getTenantDb(orgId);

    return await db.query(async (tx) => {
      // 1. Get organization details (RLS enforced)
      const [org] = await tx.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);

      if (!org) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
      }

      // 2. Get audit statistics
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [stats] = await tx.select({
        total: sql<number>`count(*)`,
        verified: sql<number>`count(*) filter (where status = 'VERIFIED')`,
        flagged: sql<number>`count(*) filter (where status = 'FLAGGED')`,
        pending: sql<number>`count(*) filter (where status = 'PENDING')`,
        last_24h: sql<number>`count(*) filter (where created_at >= ${yesterday})`,
        last_7d: sql<number>`count(*) filter (where created_at >= ${lastWeek})`,
      })
      .from(auditLogs)
      .where(eq(auditLogs.orgId, orgId));

      const flagged = Number(stats.flagged) || 0;

      // 3. Get recent audit logs
      const recentLogs = await tx.select()
        .from(auditLogs)
        .where(eq(auditLogs.orgId, orgId))
        .orderBy(desc(auditLogs.createdAt))
        .limit(10);

      // Task M37: Institutional Rights Calculation
      // 1. Human Agency: Based on bias audit status
      const humanAgencyScore = flagged === 0 ? 100 : Math.max(20, 100 - (flagged * 15));
      
      // 2. Explanation: Based on presence of model metadata and XAI usage
      const modelCount = await tx.select({ count: sql<number>`count(*)` }).from(models).where(eq(models.orgId, orgId));
      const explanationLogs = await tx.select({ count: sql<number>`count(*)` })
        .from(auditLogs)
        .where(and(eq(auditLogs.orgId, orgId), eq(auditLogs.eventType, 'TRANSPARENCY_EXPLANATION')));
      const explanationScore = Number(modelCount[0].count) > 0 
        ? Math.min(100, 60 + (Number(explanationLogs[0].count) * 10)) 
        : 50;

      // 3. Empathy: Based on Empathy Audit results
      const empathyLogs = await tx.select()
        .from(auditLogs)
        .where(and(eq(auditLogs.orgId, orgId), eq(auditLogs.eventType, 'EMPATHY_CHECK')))
        .limit(5);
      const avgEmpathy = empathyLogs.length > 0
        ? empathyLogs.reduce((acc, log) => acc + (Number((log.details as Record<string, unknown>)?.empathy_score) || 0), 0) / empathyLogs.length
        : 75; // Default baseline
      const empathyScore = Math.round(avgEmpathy);

      // 4. Correction: Based on Appeal resolution time and volume
      const totalAppeals = await tx.select({ count: sql<number>`count(*)` }).from(correctionRequests).where(eq(correctionRequests.orgId, orgId));
      const resolvedAppeals = await tx.select({ count: sql<number>`count(*)` })
        .from(correctionRequests)
        .where(and(eq(correctionRequests.orgId, orgId), eq(correctionRequests.status, 'RESOLVED')));
      const correctionScore = Number(totalAppeals[0].count) > 0
        ? Math.round((Number(resolvedAppeals[0].count) / Number(totalAppeals[0].count)) * 100)
        : 90; // Standard process baseline

      // 5. Truth: Based on AI Disclosure audits
      const disclosureLogs = await tx.select()
        .from(auditLogs)
        .where(and(eq(auditLogs.orgId, orgId), eq(auditLogs.eventType, 'INSURANCE_SYNC'))); // Example proxy
      const truthScore = disclosureLogs.length > 0 ? 95 : 85;

      const integrityScore = org.integrityScore || 0;

      const rightsCompliance = {
        human_agency: {
          name: 'Right to Human Agency',
          status: humanAgencyScore >= 80 ? 'COMPLIANT' : 'ATTENTION_NEEDED',
          score: humanAgencyScore
        },
        explanation: {
          name: 'Right to Explanation',
          status: explanationScore >= 80 ? 'COMPLIANT' : 'PARTIAL',
          score: explanationScore
        },
        empathy: {
          name: 'Right to Empathy',
          status: empathyScore >= 70 ? 'COMPLIANT' : 'NEEDS_REWRITE',
          score: empathyScore
        },
        correction: {
          name: 'Right to Correction',
          status: correctionScore >= 80 ? 'COMPLIANT' : 'SLUGGISH',
          score: correctionScore
        },
        truth: {
          name: 'Right to Truth',
          status: truthScore >= 90 ? 'COMPLIANT' : 'PARTIAL',
          score: truthScore
        }
      };

      // Overall rights score
      const rightsScores = Object.values(rightsCompliance).map(r => r.score);
      const overallRightsScore = Math.round(
        rightsScores.reduce((a, b) => a + b, 0) / rightsScores.length
      );

      // 6. Action items
      const actionItems = [];
      if (Number(stats.pending) > 0) {
        actionItems.push({
          type: 'PENDING_REVIEW',
          priority: 'high',
          title: `${stats.pending} decisions pending human review`,
          action: 'Review pending audit logs'
        });
      }
      if (Number(stats.flagged) > 0) {
        actionItems.push({
          type: 'FLAGGED_DECISION',
          priority: 'critical',
          title: `${stats.flagged} decisions flagged for bias`,
          action: 'Investigate flagged decisions'
        });
      }

      return NextResponse.json({
        organization: {
          id: org.id,
          name: org.name,
          tier: org.tier,
          is_alpha: org.isAlpha
        },
        integrity: {
          score: integrityScore,
          trend: 0,
          status: integrityScore >= 80 ? 'HEALTHY' : integrityScore >= 60 ? 'ATTENTION' : 'CRITICAL'
        },
        audit_summary: {
          total: Number(stats.total) || 0,
          verified: Number(stats.verified) || 0,
          flagged: Number(stats.flagged) || 0,
          pending: Number(stats.pending) || 0,
          last_24h: Number(stats.last_24h) || 0,
          last_7d: Number(stats.last_7d) || 0
        },
        rights_compliance: rightsCompliance,
        overall_rights_score: overallRightsScore,
        recent_logs: recentLogs.map(log => ({
          id: log.id,
          action: log.eventType,
          input_type: log.systemName,
          status: log.status,
          created_at: log.createdAt,
          outcome: (log.details as Record<string, unknown>)?.outcome
        })),
        action_items: actionItems,
        tier_requirements: getTierRequirements(org.tier || 'TIER_3'),
        mode: 'LIVE',
        timestamp: new Date().toISOString()
      });
    });

  } catch (error) {
    console.error('[SECURITY] Dashboard API Error:', error);
    return NextResponse.json({ error: 'Failed to retrieve institutional intelligence' }, { status: 500 });
  }
}

function getTierRequirements(tier: string) {
  const requirements = {
    TIER_1: {
      human_review: '100% of decisions',
      audit_frequency: 'Quarterly',
      incident_response: '24 hours',
      governance: 'Board-level oversight required'
    },
    TIER_2: {
      human_review: 'Edge cases and flagged decisions',
      audit_frequency: 'Annual',
      incident_response: '72 hours',
      governance: 'Designated compliance officer'
    },
    TIER_3: {
      human_review: 'Periodic sampling',
      audit_frequency: 'Annual self-assessment',
      incident_response: '7 days',
      governance: 'Internal policy documentation'
    }
  };

  return requirements[tier as keyof typeof requirements] || requirements.TIER_3;
}
