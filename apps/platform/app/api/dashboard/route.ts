import { NextResponse } from 'next/server';
import { getTenantDb, organizations, auditLogs, models, correctionRequests, eq, and, sql, desc } from '@aic/db';
import { getSession } from '@/lib/auth';
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

      // Rights indicators, from this organisation's own records only.
      //
      // These used to fall back to invented baselines when there was no data —
      // empathy 75, correction 90, truth 85, explanation 50 — so an
      // organisation that had recorded nothing at all was shown a respectable
      // score. Where there is nothing to measure, the score is null and the
      // status says so. A certification body cannot show a client a number it
      // made up.
      type Indicator = { name: string; status: string; score: number | null };
      const noData = (name: string): Indicator => ({ name, status: 'NO_DATA', score: null });

      const auditCount = Number(stats.total) || 0;
      const human_agency: Indicator = auditCount > 0
        ? (() => {
            const score = flagged === 0 ? 100 : Math.max(0, Math.round(100 - (flagged / auditCount) * 100));
            return { name: 'Right to Human Agency', status: score >= 80 ? 'COMPLIANT' : 'ATTENTION_NEEDED', score };
          })()
        : noData('Right to Human Agency');

      const [explanationLogs] = await tx.select({ count: sql<number>`count(*)` })
        .from(auditLogs)
        .where(and(eq(auditLogs.orgId, orgId), eq(auditLogs.eventType, 'TRANSPARENCY_EXPLANATION')));
      const [modelCount] = await tx.select({ count: sql<number>`count(*)` }).from(models).where(eq(models.orgId, orgId));
      const explanation: Indicator = Number(modelCount.count) > 0 && Number(explanationLogs.count) > 0
        ? (() => {
            const score = Math.min(100, Math.round((Number(explanationLogs.count) / Number(modelCount.count)) * 100));
            return { name: 'Right to Explanation', status: score >= 80 ? 'COMPLIANT' : 'PARTIAL', score };
          })()
        : noData('Right to Explanation');

      const empathyLogs = await tx.select()
        .from(auditLogs)
        .where(and(eq(auditLogs.orgId, orgId), eq(auditLogs.eventType, 'EMPATHY_CHECK')))
        .orderBy(desc(auditLogs.createdAt))
        .limit(5);
      const empathyScores = empathyLogs
        .map((log) => Number((log.details as Record<string, unknown>)?.empathy_score))
        .filter((n) => Number.isFinite(n));
      const empathy: Indicator = empathyScores.length > 0
        ? (() => {
            const score = Math.round(empathyScores.reduce((a, n) => a + n, 0) / empathyScores.length);
            return { name: 'Right to Empathy', status: score >= 70 ? 'COMPLIANT' : 'NEEDS_REWRITE', score };
          })()
        : noData('Right to Empathy');

      const [totalAppeals] = await tx.select({ count: sql<number>`count(*)` }).from(correctionRequests).where(eq(correctionRequests.orgId, orgId));
      const [resolvedAppeals] = await tx.select({ count: sql<number>`count(*)` })
        .from(correctionRequests)
        .where(and(eq(correctionRequests.orgId, orgId), eq(correctionRequests.status, 'RESOLVED')));
      const correction: Indicator = Number(totalAppeals.count) > 0
        ? (() => {
            const score = Math.round((Number(resolvedAppeals.count) / Number(totalAppeals.count)) * 100);
            return { name: 'Right to Correction', status: score >= 80 ? 'COMPLIANT' : 'SLUGGISH', score };
          })()
        : noData('Right to Correction');

      // Nothing in the record measures disclosure yet. Said plainly rather than
      // proxied from an unrelated event type, as it was.
      const truth = noData('Right to Truth');

      const integrityScore = org.integrityScore ?? null;

      const rightsCompliance = { human_agency, explanation, empathy, correction, truth };

      const measured = Object.values(rightsCompliance)
        .map((r) => r.score)
        .filter((n): n is number => n !== null);
      const overallRightsScore = measured.length > 0
        ? Math.round(measured.reduce((a, b) => a + b, 0) / measured.length)
        : null;

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
          status: integrityScore === null ? 'NOT_ASSESSED' : integrityScore >= 80 ? 'HEALTHY' : integrityScore >= 60 ? 'ATTENTION' : 'CRITICAL'
        },
        rights_measured: measured.length,
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
