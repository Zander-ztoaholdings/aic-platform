import { NextResponse } from 'next/server';
import { auth } from '@aic/auth';
import { getSystemDb, sql } from '@aic/db';
import { hasCapability } from '@/lib/rbac';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const authorized = await hasCapability(session.user.id, 'view_revenue');
  if (!authorized) return NextResponse.json({ error: 'Forbidden', message: 'Missing capability: view_revenue' }, { status: 403 });

  try {
    const db = getSystemDb();
    const revenueStats = await db.execute(sql`
      SELECT 
        tier, 
        COUNT(*) as active_clients,
        CASE 
          WHEN tier = 'TIER_1' THEN 38000
          WHEN tier = 'TIER_2' THEN 12400
          ELSE 0 
        END as tier_price
      FROM organizations
      WHERE billing_status = 'ACTIVE'
      GROUP BY tier
    `);

    const totalMRR = revenueStats.rows.reduce((acc: number, row: any) => 
      acc + (Number(row.active_clients) * Number(row.tier_price)), 0);

    return NextResponse.json({
      mrr: totalMRR,
      currency: 'USD',
      breakdown: revenueStats.rows,
      trend: '+12%'
    });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch revenue data' }, { status: 500 });
  }
}
