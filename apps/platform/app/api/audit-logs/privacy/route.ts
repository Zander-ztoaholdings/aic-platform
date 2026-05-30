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

        if (!data?.columns || !Array.isArray(data.columns) || data.columns.length === 0) {
            return NextResponse.json({ error: 'columns array is required' }, { status: 400 });
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

          // Call engine privacy audit
          const engineResponse = await fetch(`${ENGINE_URL}/api/v1/audit/privacy`, {
              method: 'POST',
              headers: engineHeaders(),
              body: JSON.stringify({ columns: data.columns })
          });

          if (!engineResponse.ok) {
              const errorDetail = await engineResponse.text();
              throw new Error(`Privacy audit failed: ${errorDetail}`);
          }

          const result = await engineResponse.json();

          // Log to audit trail
          await tx.insert(auditLogs).values({
            orgId,
            systemName: systemName || 'Privacy Audit',
            eventType: 'PRIVACY_AUDIT',
            details: result,
            integrityHash: result.audit_hash,
            previousHash,
            status: 'VERIFIED'
          });

          return NextResponse.json({ success: true, analysis: result });
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[SECURITY] Privacy Audit Error:', message);
        return NextResponse.json({ error: 'Privacy audit failed', detail: message }, { status: 500 });
    }
}
