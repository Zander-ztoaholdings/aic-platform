import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, aiSystems, auditLedger, HashChainService, eq, and, desc } from '@aic/db';
import { auth } from '@aic/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: systemId } = await params;
  const orgId = session.user.orgId;
  const db = getTenantDb(orgId);

  try {
    await db.query(async (tx) => {
      // 1. Mark system as no longer sandbox
      await tx.update(aiSystems)
        .set({ isSandbox: false, updatedAt: new Date() })
        .where(and(eq(aiSystems.id, systemId), eq(aiSystems.orgId, orgId)));

      // 2. Create a permanent, immutable record in the audit_ledger of the PROMOTION event
      const [lastLedgerEntry] = await tx
        .select({ currentHash: auditLedger.currentHash })
        .from(auditLedger)
        .where(eq(auditLedger.orgId, orgId))
        .orderBy(desc(auditLedger.timestamp))
        .limit(1);

      const previousHash = lastLedgerEntry?.currentHash || null;
      const currentHash = HashChainService.computeHash({ 
        action: 'PROMOTE_TO_FORMAL_AUDIT', 
        systemId, 
        timestamp: new Date().toISOString() 
      }, previousHash);

      await tx.insert(auditLedger).values({
        orgId,
        type: 'FORMAL',
        currentHash,
        previousHash,
        timestamp: new Date(),
        signature: `SIG_PROMOTED_BY_${session.user.id}`
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Promotion Error:', error);
    return NextResponse.json({ error: 'Failed to promote system to formal audit' }, { status: 500 });
  }
}
