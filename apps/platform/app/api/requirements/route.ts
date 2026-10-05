import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, auditRequirements, eq, and, asc } from '@aic/db';
import { getSession } from '@/lib/auth';
import type { Session } from 'next-auth';
import { fetchPublishedStandard } from '@/lib/standard';
import { canManageCompliance } from '@/lib/roles';

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

      // The names of the five Rights come from the published standard rather
      // than a copy held here, and are fetched server-side so the browser is
      // not making a cross-origin call to aic-web. A failure is not fatal: the
      // roadmap falls back to the bare Right code.
      let rights;
      try {
        rights = (await fetchPublishedStandard()).rights;
      } catch {
        rights = undefined;
      }

      return NextResponse.json({
          requirements: result,
          rights,
          orgId
      });
    });
  } catch (error) {
    console.error('[SECURITY] Audit Requirements GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}


export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession() as Session | null;
    if (!session || !session.user?.orgId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!canManageCompliance(session.user.role as string | undefined)) {
        return NextResponse.json({ error: 'Your role does not allow submitting evidence.' }, { status: 403 });
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

      // This used to send a hard-coded paragraph ("This policy ensures human
      // intervention…") to the engine as if it were the client's document, and
      // store the engine's score as the finding. That is a fabricated
      // verification. Evidence is now verified by a named assessor in
      // /admin/verification; submitting only records that it was submitted.
      const findings = null;
      const autoStatus = 'SUBMITTED';

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
          message: 'Evidence submitted. An AIC assessor will review it.',
          findings 
      });
    });
  } catch (error) {
    console.error('[SECURITY] Audit Requirements Update Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
