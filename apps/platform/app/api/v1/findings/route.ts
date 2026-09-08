import { NextRequest, NextResponse } from 'next/server';
import { getSystemDb, auditFindings, auditRequirements, auditDocuments, and, eq, desc } from '@aic/db';
import { auth } from '@aic/auth';
import { hasCapability } from '@/lib/rbac';
import { z } from 'zod';

/**
 * Auditor findings.
 *
 * This is the link the evidence chain was missing. Before 8 Sep 2026 a finding
 * was a single free-text column on audit_requirements, overwritten by each
 * scan, with no severity, no owner, no due date and no closure state — and the
 * UI guessed severity by substring-matching the word "critical" in a title.
 *
 * Severity uses the vocabulary AIC's own Audit and Certification Methodology
 * v0.1 §5 already defines, rather than adding a fourth grading vocabulary to a
 * scheme that already has three competing ones.
 */

const RaiseSchema = z.object({
  orgId: z.string().uuid(),
  requirementId: z.string().uuid().optional(),
  documentId: z.string().uuid().optional(),
  severity: z.enum(['MAJOR', 'MINOR', 'OBSERVATION', 'ETHICAL_CONCERN']),
  title: z.string().min(3).max(255),
  description: z.string().min(10),
  dueAt: z.string().datetime().optional(),
});

// GET /api/v1/findings?orgId=… — an organisation sees its own; AIC staff see any.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const requestedOrgId = request.nextUrl.searchParams.get('orgId');
  const isAicStaff = await hasCapability(session.user.id, 'conduct_assessment');
  const orgId = isAicStaff && requestedOrgId ? requestedOrgId : session.user.orgId;

  if (!orgId) return NextResponse.json({ error: 'No organisation in scope' }, { status: 400 });
  if (!isAicStaff && requestedOrgId && requestedOrgId !== session.user.orgId) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const db = getSystemDb();
  const findings = await db
    .select({
      id: auditFindings.id,
      severity: auditFindings.severity,
      title: auditFindings.title,
      description: auditFindings.description,
      status: auditFindings.status,
      raisedAt: auditFindings.raisedAt,
      dueAt: auditFindings.dueAt,
      closedAt: auditFindings.closedAt,
      closureNotes: auditFindings.closureNotes,
      requirementTitle: auditRequirements.title,
      documentTitle: auditDocuments.title,
    })
    .from(auditFindings)
    .leftJoin(auditRequirements, eq(auditFindings.requirementId, auditRequirements.id))
    .leftJoin(auditDocuments, eq(auditFindings.documentId, auditDocuments.id))
    .where(eq(auditFindings.orgId, orgId))
    .orderBy(desc(auditFindings.raisedAt));

  return NextResponse.json({ findings });
}

// POST /api/v1/findings — raise one. AIC staff only: a finding is AIC's judgement.
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAicStaff = await hasCapability(session.user.id, 'conduct_assessment');
  if (!isAicStaff) {
    return NextResponse.json(
      { error: 'Forbidden', message: 'Missing capability: conduct_assessment' },
      { status: 403 }
    );
  }

  try {
    const data = RaiseSchema.parse(await request.json());
    const db = getSystemDb();

    // A finding must attach to the same organisation as the requirement and
    // evidence it cites, or the record says something untrue.
    if (data.requirementId) {
      const [req_] = await db.select({ id: auditRequirements.id }).from(auditRequirements)
        .where(and(eq(auditRequirements.id, data.requirementId), eq(auditRequirements.orgId, data.orgId)))
        .limit(1);
      if (!req_) return NextResponse.json({ error: 'Requirement does not belong to that organisation' }, { status: 400 });
    }
    if (data.documentId) {
      const [doc] = await db.select({ id: auditDocuments.id }).from(auditDocuments)
        .where(and(eq(auditDocuments.id, data.documentId), eq(auditDocuments.orgId, data.orgId)))
        .limit(1);
      if (!doc) return NextResponse.json({ error: 'Evidence does not belong to that organisation' }, { status: 400 });
    }

    const [finding] = await db.insert(auditFindings).values({
      orgId: data.orgId,
      requirementId: data.requirementId ?? null,
      documentId: data.documentId ?? null,
      raisedBy: session.user.id,
      severity: data.severity,
      title: data.title,
      description: data.description,
      dueAt: data.dueAt ? new Date(data.dueAt) : null,
    }).returning();

    return NextResponse.json({ finding }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', issues: error.issues }, { status: 400 });
    }
    console.error('[FINDINGS_POST_ERROR]', error);
    return NextResponse.json({ error: 'Could not raise finding' }, { status: 500 });
  }
}
