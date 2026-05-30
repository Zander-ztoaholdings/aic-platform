import { getSystemDb, decisionRecords, auditLedger, sql } from '@aic/db';
import { createHash } from 'crypto';

/**
 * Atomic transaction to record a decision and its cryptographic hash in the ledger.
 */
export async function recordDecisionWithLedger(data: any) {
  const db = getSystemDb();

  return await db.transaction(async (tx) => {
    // 1. Calculate integrity hash for the decision content
    const content = JSON.stringify({
      orgId: data.orgId,
      systemName: data.systemName,
      inputParams: data.inputParams,
      outcome: data.outcome
    });
    
    const currentHash = createHash('sha256').update(content).digest('hex');

    // 2. Fetch previous hash for the organization's chain
    const [lastEntry] = await tx
      .select({ currentHash: auditLedger.currentHash })
      .from(auditLedger)
      .where(sql`${auditLedger.orgId} = ${data.orgId}`)
      .orderBy(sql`${auditLedger.timestamp} DESC`)
      .limit(1);

    const previousHash = lastEntry?.currentHash || null;

    // 3. Insert Decision Record
    const [decision] = await tx.insert(decisionRecords).values({
      orgId: data.orgId,
      systemName: data.systemName,
      inputParams: data.inputParams,
      outcome: data.outcome,
      explanation: data.explanation,
      integrityHash: currentHash,
      isHumanOverride: data.isHumanOverride || false,
      overrideReason: data.overrideReason,
      overriddenBy: data.overriddenBy
    }).returning();

    // [SECURITY] HITL Trigger Enforcement (Strategic Framework)
    // If this was a human override of a high-risk system, ensure it is mirrored in hitl_logs
    if (data.isHumanOverride) {
      const { hitlLogs } = await import('@aic/db');
      await tx.insert(hitlLogs).values({
        actorId: data.overriddenBy,
        targetType: 'DECISION_OVERRIDE',
        targetId: decision.id,
        previousValue: data.originalOutcome || null,
        newValue: data.outcome,
        overrideReason: data.overrideReason || 'Regulatory manual override',
        integrityHash: currentHash
      });
    }

    // 4. Insert Ledger Entry (Immutable Link)
    await tx.insert(auditLedger).values({
      orgId: data.orgId,
      type: 'FORMAL',
      currentHash,
      previousHash,
      timestamp: new Date()
    });

    return decision;
  });
}
