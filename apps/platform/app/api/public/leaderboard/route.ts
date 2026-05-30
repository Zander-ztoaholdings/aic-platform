import { NextRequest, NextResponse } from 'next/server';
import { getSystemDb, sql } from '@aic/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const industry = searchParams.get('industry');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    const db = getSystemDb();

    // Fetch from public_index_rankings (B0-3)
    let query = sql`
      SELECT 
        id, 
        company_name as "company", 
        industry,
        ticker,
        maturity_score as "maturityScore",
        board_oversight_score as "boardOversight",
        rights_compliance_score as "rightsCompliance",
        transparency_score as "transparency",
        risk_management_score as "riskManagement",
        policy_hit_rate as "policyHitRate",
        human_override_rate as "humanOverrideRate",
        trend,
        is_client as "hasAICertification"
      FROM public_index_rankings
    `;

    if (industry && industry !== 'all') {
      query = sql`${query} WHERE industry = ${industry}`;
    }

    query = sql`${query} ORDER BY maturity_score DESC LIMIT ${limit} OFFSET ${offset}`;

    const leaderboard = await db.execute(query);

    return NextResponse.json(leaderboard.rows);
  } catch (error) {
    console.error('[PUBLIC_LEADERBOARD_API] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
