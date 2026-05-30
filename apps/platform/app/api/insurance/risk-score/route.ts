import { NextResponse } from 'next/server';
import { getTenantDb, organizations, eq } from '@aic/db';
import { getSession } from '../../../../lib/auth';
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
      // 1. Fetch current integrity score
      const [org] = await tx
          .select({ 
            name: organizations.name, 
            integrityScore: organizations.integrityScore, 
            tier: organizations.tier 
          })
          .from(organizations)
          .where(eq(organizations.id, orgId))
          .limit(1);

      if (!org) {
          return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
      }

      // 2. Map Integrity Score to Insurance Risk Rating
      const score = org.integrityScore || 0;
      const riskRating = score > 90 ? 'AAA' : 
                         score > 80 ? 'AA' :
                         score > 70 ? 'A' :
                         score > 50 ? 'BBB' : 'C (UNINSURABLE)';

      return NextResponse.json({
          success: true,
          organization: org.name,
          timestamp: new Date().toISOString(),
          assessment: {
              integrity_score: score,
              tier: org.tier,
              insurance_risk_rating: riskRating,
              recommendation: score > 80 ? 'APPROVED_FOR_DISCOUNT' : 'REQUIRE_REMEDIATION'
          }
      });
    });

  } catch (error) {
    console.error('[SECURITY] Insurance API Error:', error);
    return NextResponse.json({ error: 'Failed to retrieve risk profile' }, { status: 500 });
  }
}