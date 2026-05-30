import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, decisionRecords, eq, desc } from '@aic/db';
import { auth } from '@aic/auth';
import { recordDecisionWithLedger } from '@/lib/ledger';

export async function GET() {
  try {
    const session = await auth();
    if (!session || !session.user?.orgId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const orgId = session.user.orgId;
    const db = getTenantDb(orgId);

    return await db.query(async (tx) => {
      const result = await tx
        .select()
        .from(decisionRecords)
        .where(eq(decisionRecords.orgId, orgId))
        .orderBy(desc(decisionRecords.createdAt))
        .limit(50);

      return NextResponse.json({ decisions: result });
    });
  } catch (error) {
    console.error('[SECURITY] Decisions GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user?.orgId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const orgId = session.user.orgId;

    const body = await request.json();
    const { 
      system_name, 
      input_params, 
      outcome, 
      explanation,
      isHumanOverride,
      overrideReason,
      originalOutcome
    } = body;

    if (!system_name || !input_params || !outcome) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const decision = await recordDecisionWithLedger({
      orgId,
      systemName: system_name,
      inputParams: input_params,
      outcome,
      explanation,
      isHumanOverride: isHumanOverride || false,
      overrideReason: overrideReason,
      originalOutcome: originalOutcome,
      overriddenBy: session.user.id
    });

    return NextResponse.json({ success: true, decision });
  } catch (error) {
    console.error('[SECURITY] Decisions POST Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
