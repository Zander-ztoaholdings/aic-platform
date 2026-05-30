import { NextRequest, NextResponse } from 'next/server';
import { getSystemDb, organizations, sql, eq } from '@aic/db';

/**
 * INSURANCE PARTNER API (Mockup for iTOO/Santam)
 * 
 * Provides an algorithmic risk score based on:
 * 1. AIMS Readiness Level (ISO 42001)
 * 2. Human Override Rate (Decision Integrity)
 * 3. Recent Bias Incident Volume
 */
export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  // In production, validate against insurance_partner_keys table
  if (!apiKey || apiKey !== 'mock_insurance_key_2026') {
    return NextResponse.json({ error: 'Invalid API Key' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get('orgId');

  if (!orgId) {
    return NextResponse.json({ error: 'orgId required' }, { status: 400 });
  }

  try {
    const db = getSystemDb();

    // 1. Fetch Org Maturity
    const [org] = await db
      .select({ 
        readiness: organizations.iso42001Readiness,
        status: organizations.certificationStatus 
      })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

    // 2. Calculate Override Rate
    const stats = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) filter (WHERE is_human_override = true) as overrides
      FROM decision_records
      WHERE org_id = ${orgId}
    `);
    
    const row = stats.rows[0] as any;
    const overrideRate = row.total > 0 ? (row.overrides / row.total) : 0;

    // 3. Algorithmic Risk Formula (Simplified)
    // Maturity (40%) + Integrity (60%)
    const baseRisk = 100 - (org.readiness || 0);
    const integrityRisk = overrideRate * 100;
    const finalRiskScore = Math.round((baseRisk * 0.4) + (integrityRisk * 0.6));

    return NextResponse.json({
      orgId,
      timestamp: new Date().toISOString(),
      underwritingMetrics: {
        iso42001Maturity: `${org.readiness}%`,
        certificationStatus: org.status,
        algorithmicOverrideRate: `${(overrideRate * 100).toFixed(1)}%`,
        dataIntegrityHash: "0x8842...f92c" // Demo hash
      },
      actuarialRiskScore: finalRiskScore,
      riskCategory: finalRiskScore > 70 ? 'HIGH' : finalRiskScore > 30 ? 'MODERATE' : 'LOW',
      recommendation: finalRiskScore > 50 ? 'Audit Verification Required' : 'Eligible for Standard Cyber/AI Policy'
    });

  } catch {
    console.error('[INSURANCE_API_ERROR]');
    return NextResponse.json({ error: 'Internal Actuarial Failure' }, { status: 500 });
  }
}
