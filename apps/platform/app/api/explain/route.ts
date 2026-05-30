import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, auditLogs } from '@aic/db';
import { EngineClient } from '../../../lib/engine-client';
import { getSession } from '../../../lib/auth';
import type { Session } from 'next-auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession() as Session | null;
    if (!session || !session.user?.orgId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const orgId = session.user.orgId;

    const body = await request.json();
    const { modelType, inputFeatures, decision } = body;

    // 1. Call Python Engine for Local Explanation (XAI)
    const explanation = await EngineClient.explainDecision(orgId, modelType, inputFeatures, decision);

    if (explanation.error) {
        throw new Error(explanation.error);
    }

    const db = getTenantDb(orgId);

    // 2. Log this as a transparency event in audit_logs
    await db.query(async (tx) => {
      await tx.insert(auditLogs).values({
        orgId,
        systemName: modelType,
        eventType: 'TRANSPARENCY_EXPLANATION',
        details: { input: inputFeatures, output: explanation },
        status: 'VERIFIED',
        integrityHash: `EXP-${Date.now()}`
      });
    });

    return NextResponse.json({ success: true, explanation });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SECURITY] Explanation Service Error:', message);
    return NextResponse.json({ error: 'Failed to generate explanation' }, { status: 500 });
  }
}
