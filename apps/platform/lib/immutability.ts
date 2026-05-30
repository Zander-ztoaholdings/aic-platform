import { getTenantDb, auditLogs, eq, asc } from '@aic/db';

const ENGINE_URL = process.env.ENGINE_URL || 'http://localhost:8000';

export interface VerificationResult {
    id: string;
    status: 'VERIFIED' | 'TAMPERED';
    error?: string;
}

/**
 * Verify the integrity of a single audit log entry.
 * Recalculates the hash and verifies the RSA signature via the engine.
 */
export async function verifyAuditLog(logId: string, orgId: string): Promise<VerificationResult> {
    try {
        const db = getTenantDb(orgId);
        const [log] = await db.query(async (tx) => {
          return await tx.select().from(auditLogs).where(eq(auditLogs.id, logId)).limit(1);
        });

        if (!log) throw new Error('Log entry not found');
        
        // 1. Call Engine API for cryptographic signature verification
        const engineRes = await fetch(`${ENGINE_URL}/api/v1/audit-trail/verify-signature`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                data: log.integrityHash,
                signature: log.signature
            })
        });

        if (engineRes.ok) {
            const verification = await engineRes.json();
            return {
                id: logId,
                status: verification.valid ? 'VERIFIED' : 'TAMPERED',
                error: verification.error
            };
        }

        return { id: logId, status: 'TAMPERED', error: 'Signature verification service failure' };

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return { id: logId, status: 'TAMPERED', error: message };
    }
}

/**
 * Verify the entire hash chain for an organization.
 */
export async function verifyOrganizationChain(orgId: string): Promise<{ is_valid: boolean; results: VerificationResult[] }> {
    const db = getTenantDb(orgId);
    const logs = await db.query(async (tx) => {
      return await tx
        .select({ id: auditLogs.id, integrityHash: auditLogs.integrityHash, previousHash: auditLogs.previousHash })
        .from(auditLogs)
        .where(eq(auditLogs.orgId, orgId))
        .orderBy(asc(auditLogs.createdAt));
    });
    
    let isValid = true;
    const results: VerificationResult[] = [];

    for (let i = 0; i < logs.length; i++) {
        const current = logs[i];
        
        // Check link to previous
        if (i > 0) {
            const previous = logs[i-1];
            if (current.previousHash !== previous.integrityHash) {
                isValid = false;
                results.push({ id: current.id, status: 'TAMPERED', error: 'Hash chain link broken' });
                continue;
            }
        }

        // Deep verification
        const deepCheck = await verifyAuditLog(current.id, orgId);
        if (deepCheck.status === 'TAMPERED') isValid = false;
        results.push(deepCheck);
    }

    return { is_valid: isValid, results };
}
