import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, auditLogs, eq, desc } from '@aic/db';
import { getSession } from '../../../../lib/auth';
import type { Session } from 'next-auth';

const ENGINE_URL = process.env.ENGINE_URL || 'http://localhost:8000';
const ENGINE_API_KEY = process.env.ENGINE_API_KEY || '';

function engineHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (ENGINE_API_KEY) headers['X-API-Key'] = ENGINE_API_KEY;
    return headers;
}

export async function POST(request: NextRequest) {
    try {
        const session = await getSession() as Session | null;
        if (!session || !session.user?.orgId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        if (session.user.role !== 'ADMIN' && session.user.role !== 'COMPLIANCE_OFFICER') {
            return NextResponse.json({ error: 'Compliance Officer privileges required' }, { status: 403 });
        }

        const orgId = session.user.orgId;
        const body = await request.json();
        const { systemName, data } = body;

        if (typeof data?.total_decisions !== 'number' || typeof data?.human_interventions !== 'number' || typeof data?.human_overrides !== 'number') {
            return NextResponse.json({ error: 'total_decisions, human_interventions, and human_overrides are required' }, { status: 400 });
        }

        const db = getTenantDb(orgId);

        return await db.query(async (tx) => {
          // Fetch last hash for chain continuity
          const [lastLog] = await tx
              .select({ integrityHash: auditLogs.integrityHash })
              .from(auditLogs)
              .where(eq(auditLogs.orgId, orgId))
              .orderBy(desc(auditLogs.createdAt))
              .limit(1);
          
          const previousHash = lastLog?.integrityHash || null;

          // Call engine labor audit
          const engineResponse = await fetch(`${ENGINE_URL}/api/v1/audit/labor`, {
              method: 'POST',
              headers: engineHeaders(),
              body: JSON.stringify({
                  total_decisions: data.total_decisions,
                  human_interventions: data.human_interventions,
                  human_overrides: data.human_overrides
              })
          });

          if (!engineResponse.ok) {
              const errorDetail = await engineResponse.text();
              throw new Error(`Labor audit failed: ${errorDetail}`);
          }

          const result = await engineResponse.json();

          // Log to audit trail
          await tx.insert(auditLogs).values({
            orgId,
            systemName: systemName || 'Labor Audit',
            eventType: 'LABOR_AUDIT',
            details: result,
            integrityHash: result.audit_hash,
            previousHash,
            status: 'VERIFIED'
          });

          return NextResponse.json({ success: true, analysis: result });
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[SECURITY] Labor Audit Error:', message);
        return NextResponse.json({ error: 'Labor audit failed', detail: message }, { status: 500 });
    }
}
