import { getSystemDb, systemLedger, desc, PgTransaction, PgQueryResultHKT, schema } from '../db';
import { createHash } from 'crypto';

const db = getSystemDb();

/**
 * INSTITUTIONAL LEDGER SERVICE
 * 
 * Manages an immutable, cryptographically-linked global audit trail
 * for all administrative and system-level actions.
 */
export class LedgerService {
  /**
   * Append a new notarized entry to the global system ledger
   */
  static async append(action: string, actorId: string | null, details: Record<string, unknown>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await db.transaction(async (tx: PgTransaction<PgQueryResultHKT, typeof schema, any>) => {
      // 1. Fetch the latest entry to get its hash
      const [lastEntry] = await tx
        .select({ 
          integrityHash: systemLedger.integrityHash,
          sequenceNumber: systemLedger.sequenceNumber 
        })
        .from(systemLedger)
        .orderBy(desc(systemLedger.sequenceNumber))
        .limit(1);

      const previousHash = lastEntry?.integrityHash || 'GENESIS_BLOCK';
      const sequenceNumber = (lastEntry?.sequenceNumber || 0) + 1;

      // 2. Generate the new integrity hash (Chained to previous)
      const dataToHash = JSON.stringify({
        action,
        actorId,
        details,
        previousHash,
        sequenceNumber,
      });
      
      const integrityHash = createHash('sha256').update(dataToHash).digest('hex');

      // 3. Persist notarized record
      await tx.insert(systemLedger).values({
        action,
        actorId,
        details,
        previousHash,
        integrityHash,
        sequenceNumber,
      });

      console.log(`[LEDGER] Action recorded: ${action} (#${sequenceNumber})`);
      return { sequenceNumber, integrityHash };
    });
  }

  /**
   * Verify the integrity of the entire ledger chain
   */
  static async verifyChain(): Promise<boolean> {
    const entries = await db
      .select()
      .from(systemLedger)
      .orderBy(systemLedger.sequenceNumber);

    let expectedPreviousHash = 'GENESIS_BLOCK';

    for (const entry of entries) {
      const dataToHash = JSON.stringify({
        action: entry.action,
        actorId: entry.actorId,
        details: entry.details,
        previousHash: entry.previousHash,
        sequenceNumber: entry.sequenceNumber,
      });

      const calculatedHash = createHash('sha256').update(dataToHash).digest('hex');

      if (calculatedHash !== entry.integrityHash || entry.previousHash !== expectedPreviousHash) {
        console.error(`[LEDGER] Integrity Breach detected at sequence #${entry.sequenceNumber}`);
        return false;
      }

      expectedPreviousHash = entry.integrityHash;
    }

    return true;
  }
}
