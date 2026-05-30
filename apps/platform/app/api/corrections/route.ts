import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, correctionRequests, decisionRecords, eq, desc } from '@aic/db';
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
        .select({
          id: correctionRequests.id,
          orgId: correctionRequests.orgId,
          decisionId: correctionRequests.decisionId,
          citizenEmail: correctionRequests.citizenEmail,
          reason: correctionRequests.reason,
          supportingEvidenceUrl: correctionRequests.supportingEvidenceUrl,
          status: correctionRequests.status,
          resolutionDetails: correctionRequests.resolutionDetails,
          humanReviewerId: correctionRequests.humanReviewerId,
          createdAt: correctionRequests.createdAt,
          updatedAt: correctionRequests.updatedAt,
          systemName: decisionRecords.systemName
        })
        .from(correctionRequests)
        .leftJoin(decisionRecords, eq(correctionRequests.decisionId, decisionRecords.id))
        .where(eq(correctionRequests.orgId, orgId))
        .orderBy(desc(correctionRequests.createdAt));

      return NextResponse.json({ corrections: result });
    });
  } catch (error) {
    console.error('[SECURITY] Corrections GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession() as Session | null;
    if (!session || !session.user?.orgId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const orgId = session.user.orgId;

    const body = await request.json();
    const { decision_id, citizen_email, reason, supporting_evidence_url } = body;

    if (!citizen_email || !reason) {
        return NextResponse.json({ error: 'Citizen email and reason are required' }, { status: 400 });
    }

    const db = getTenantDb(orgId);

    return await db.query(async (tx) => {
      const [newCorrection] = await tx.insert(correctionRequests).values({
        orgId,
        decisionId: decision_id,
        citizenEmail: citizen_email,
        reason,
        supportingEvidenceUrl: supporting_evidence_url
      }).returning();

      return NextResponse.json({ success: true, correction: newCorrection });
    });
  } catch (error) {
    console.error('[SECURITY] Corrections POST Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
