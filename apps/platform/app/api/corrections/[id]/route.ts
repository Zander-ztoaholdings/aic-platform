import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, correctionRequests, eq, and } from '@aic/db';
import { getSession } from '../../../../lib/auth';
import type { Session } from 'next-auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession() as Session | null;
    if (!session || !session.user?.orgId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Task M12: RBAC check (require ADMIN or COMPLIANCE_OFFICER)
    if (session.user.role !== 'ADMIN' && session.user.role !== 'COMPLIANCE_OFFICER') {
        return NextResponse.json({ error: 'Institutional review requires Compliance Officer privileges' }, { status: 403 });
    }

    const orgId = session.user.orgId;
    const userId = session.user.id;
    const { status, resolution_details } = await request.json();

    const db = getTenantDb(orgId);

    return await db.query(async (tx) => {
      const [updatedCorrection] = await tx
        .update(correctionRequests)
        .set({ 
          status, 
          resolutionDetails: resolution_details, 
          humanReviewerId: userId, 
          updatedAt: new Date() 
        })
        .where(and(eq(correctionRequests.id, id), eq(correctionRequests.orgId, orgId)))
        .returning();

      if (!updatedCorrection) {
        return NextResponse.json({ error: 'Correction request not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, correction: updatedCorrection });
    });

  } catch (error) {
    console.error('[SECURITY] Correction PATCH Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
