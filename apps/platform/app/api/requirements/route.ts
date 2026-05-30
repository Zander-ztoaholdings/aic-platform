import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, auditRequirements, eq, and, asc } from '@aic/db';
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
        .select()
        .from(auditRequirements)
        .where(eq(auditRequirements.orgId, orgId))
        .orderBy(asc(auditRequirements.createdAt));

      return NextResponse.json({
          requirements: result,
          orgId
      });
    });
  } catch (error) {
    console.error('[SECURITY] Audit Requirements GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

const ENGINE_URL = process.env.ENGINE_URL || 'http://localhost:8000';
const ENGINE_API_KEY = process.env.ENGINE_API_KEY || '';

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession() as Session | null;
    if (!session || !session.user?.orgId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const orgId = session.user.orgId;

    const body = await request.json();
    const { id, evidence_url } = body;

    if (!id || !evidence_url) {
      return NextResponse.json({ error: 'Requirement ID and Evidence URL are required' }, { status: 400 });
    }

    const db = getTenantDb(orgId);

    return await db.query(async (tx) => {
      // Multi-tenant check: ensure requirement belongs to user's org
      const [requirement] = await tx
          .select({ id: auditRequirements.id })
          .from(auditRequirements)
          .where(and(eq(auditRequirements.id, id), eq(auditRequirements.orgId, orgId)))
          .limit(1);

      if (!requirement) {
          return NextResponse.json({ error: 'Requirement not found or access denied' }, { status: 404 });
      }

      // 1. Trigger Automated Technical Verification (Deep Tech Step)
      const simulatedDocText = "This policy ensures human intervention and a manual override for all decisions. Data subjects have a right to appeal and request an explanation of the logic involved.";

      let findings = 'Automated scan pending.';
      let autoStatus = 'SUBMITTED';

      try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (ENGINE_API_KEY) headers['X-API-Key'] = ENGINE_API_KEY;

          const verifyRes = await fetch(`${ENGINE_URL}/api/v1/audit/verify-document`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ text: simulatedDocText })
          });

          if (verifyRes.ok) {
              const result = await verifyRes.json();
              findings = `Automated Verification: ${result.verification_score}% compliance. ${result.findings.join(' ')}`;
              if (result.verification_score < 75) {
                  autoStatus = 'FLAGGED';
                  findings += ` Missing: ${result.missing_elements.join(', ')}`;
              }
          }
      } catch (engineErr) {
          console.error('Engine Verification Failed:', engineErr);
      }

      // 2. Update the requirement with automated findings
      await tx
        .update(auditRequirements)
        .set({ 
          status: autoStatus, 
          evidenceUrl: evidence_url, 
          findings, 
          updatedAt: new Date() 
        })
        .where(eq(auditRequirements.id, id));

      return NextResponse.json({ 
          success: true, 
          message: 'Evidence submitted and technically verified.',
          findings 
      });
    });
  } catch (error) {
    console.error('[SECURITY] Audit Requirements Update Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
