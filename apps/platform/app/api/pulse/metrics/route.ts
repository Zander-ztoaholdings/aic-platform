import { NextResponse } from 'next/server';
import { query } from '../../../lib/db';
import { getSession } from '../../../lib/auth';

export async function GET() {
    try {
        const session: any = await getSession();
        const orgId = session?.user?.orgId || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

        // Bias stability: % of bias audits that passed in last 30 days
        const biasResult = await query(
            `SELECT COUNT(*) FILTER (WHERE details::text LIKE '%PASSED%' OR details::text LIKE '%NOT_BIASED%') as passed,
                    COUNT(*) as total
             FROM audit_logs
             WHERE org_id = $1 AND event_type IN ('BIAS_AUDIT', 'ADVANCED_BIAS_AUDIT')
               AND created_at > NOW() - INTERVAL '30 days'`,
            [orgId]
        );
        const biasTotal = parseInt(biasResult.rows[0].total) || 0;
        const biasPassed = parseInt(biasResult.rows[0].passed) || 0;
        const biasStability = biasTotal > 0 ? Math.round((biasPassed / biasTotal) * 1000) / 10 : 0;

        // Human overrides: count from labor audits in last 24h
        const laborResult = await query(
            `SELECT COALESCE(SUM((details::json->>'human_overrides')::int), 0) as overrides
             FROM audit_logs
             WHERE org_id = $1 AND event_type = 'LABOR_AUDIT'
               AND created_at > NOW() - INTERVAL '24 hours'`,
            [orgId]
        );
        const humanOverrides = parseInt(laborResult.rows[0].overrides) || 0;

        // Explainability: % of audit logs that have an integrity_hash (verified)
        const explainResult = await query(
            `SELECT COUNT(*) FILTER (WHERE integrity_hash IS NOT NULL) as hashed,
                    COUNT(*) as total
             FROM audit_logs
             WHERE org_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
            [orgId]
        );
        const explainTotal = parseInt(explainResult.rows[0].total) || 0;
        const explainHashed = parseInt(explainResult.rows[0].hashed) || 0;
        const explainRate = explainTotal > 0 ? Math.round((explainHashed / explainTotal) * 100) : 0;

        // Total audits this month
        const monthResult = await query(
            `SELECT COUNT(*) as total FROM audit_logs
             WHERE org_id = $1 AND created_at > DATE_TRUNC('month', NOW())`,
            [orgId]
        );
        const auditsThisMonth = parseInt(monthResult.rows[0].total) || 0;

        return NextResponse.json({
            biasStability,
            biasAuditsTotal: biasTotal,
            humanOverrides,
            explainabilityRate: explainRate,
            auditsThisMonth
        });
    } catch (error) {
        console.error('Pulse Metrics Error:', error);
        return NextResponse.json({ error: 'Failed to retrieve metrics' }, { status: 500 });
    }
}
