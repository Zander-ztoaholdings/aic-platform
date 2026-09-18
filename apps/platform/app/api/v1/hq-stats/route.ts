import { NextResponse } from 'next/server';
import { getSystemDb, organizations, sql } from '@aic/db';
import { count } from 'drizzle-orm';
import { auth } from '@aic/auth';
import { hasCapability } from '@/lib/rbac';

/**
 * Institutional metrics across the whole register: pipeline distribution, total
 * organisations, average integrity, labour hours invested.
 *
 * This was session-only, over getSystemDb(), which meant any signed-in client
 * user could read AIC's entire book of business — how many organisations are on
 * the platform, where each sits in the pipeline, and the aggregate score. That
 * is commercial information about AIC and, at this cohort size, close to
 * disclosure about other clients. It is now gated on access_hq.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!(await hasCapability(session.user.id, 'access_hq'))) {
    return NextResponse.json(
      { error: 'Forbidden', message: 'Missing capability: access_hq' },
      { status: 403 }
    );
  }

  try {
    const db = getSystemDb();

    // 1. Pipeline Status Distribution
    const pipeline = await db
      .select({ 
        status: organizations.certificationStatus, 
        count: count() 
      })
      .from(organizations)
      .groupBy(organizations.certificationStatus);

    // 2. Aggregate Totals
    const [_stats]: any = await db.execute(sql`
      SELECT 
        COUNT(*) filter (WHERE certification_status = 'CERTIFIED') as active_certs,
        COALESCE(SUM(labor_hours_invested), 0) as total_labor_hours,
        COUNT(DISTINCT id) as total_orgs,
        AVG(integrity_score) as avg_integrity
      FROM organizations
    `);

    // 3. Calculate Velocity (MoM Delta)
    const [_prevStats]: any = await db.execute(sql`
      SELECT AVG(integrity_score) as prev_avg
      FROM organizations
      WHERE created_at < now() - interval '30 days'
    `);

    const currentAvg = Number(_stats?.avg_integrity || 0);
    const prevAvg = Number(_prevStats?.prev_avg || 0);
    const velocityNum = prevAvg > 0 
      ? ((currentAvg - prevAvg) / prevAvg * 100)
      : 0;
    const velocity = velocityNum.toFixed(1);

    return NextResponse.json({
      pipeline,
      metrics: _stats,
      integrityVelocity: `${velocityNum > 0 ? '+' : ''}${velocity}%`,
      citizenAppeals: 3,
      auditorUtilization: '68%'
    });

  } catch (error) {
    console.error('[HQ_STATS_ERROR]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
