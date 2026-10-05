import { NextRequest, NextResponse } from 'next/server';
import { getSystemDb, auditDocuments, auditRequirements, organizations, users, eq, desc, isNull, and, sql } from '@aic/db';
import { adminActor } from '@/lib/admin';

/**
 * The assessor's queue. Without ?orgId, every organisation with evidence and
 * how much of it is waiting for review. With ?orgId, that organisation's
 * evidence, newest first, each with the requirement it was filed against.
 */
export async function GET(request: NextRequest) {
  const actor = await adminActor('conduct_assessment');
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const db = getSystemDb();
  const orgId = request.nextUrl.searchParams.get('orgId');

  if (!orgId) {
    const rows = await db
      .select({
        orgId: organizations.id,
        name: organizations.name,
        division: organizations.division,
        total: sql<number>`count(${auditDocuments.id})::int`,
        waiting: sql<number>`count(${auditDocuments.id}) filter (where ${auditDocuments.verificationOutcome} is null and ${auditDocuments.supersededBy} is null)::int`,
        oldestWaiting: sql<string | null>`min(${auditDocuments.createdAt}) filter (where ${auditDocuments.verificationOutcome} is null and ${auditDocuments.supersededBy} is null)`,
      })
      .from(organizations)
      .innerJoin(auditDocuments, eq(auditDocuments.orgId, organizations.id))
      .groupBy(organizations.id, organizations.name, organizations.division)
      .orderBy(desc(sql`count(${auditDocuments.id}) filter (where ${auditDocuments.verificationOutcome} is null)`));
    return NextResponse.json({ organisations: rows });
  }

  if (!/^[0-9a-f-]{36}$/i.test(orgId)) return NextResponse.json({ error: 'Unknown organisation' }, { status: 400 });
  const docs = await db
    .select({
      id: auditDocuments.id,
      title: auditDocuments.title,
      fileSize: auditDocuments.fileSize,
      createdAt: auditDocuments.createdAt,
      verificationOutcome: auditDocuments.verificationOutcome,
      verificationNotes: auditDocuments.verificationNotes,
      aiTriageNotes: auditDocuments.aiTriageNotes,
      verifiedAt: auditDocuments.verifiedAt,
      supersededBy: auditDocuments.supersededBy,
      slotType: auditDocuments.slotType,
      requirementCode: auditRequirements.code,
      requirementText: auditRequirements.title,
      evidenceGuidance: auditRequirements.evidenceGuidance,
      uploadedBy: users.name,
    })
    .from(auditDocuments)
    .leftJoin(auditRequirements, eq(auditRequirements.id, auditDocuments.requirementId))
    .leftJoin(users, eq(users.id, auditDocuments.uploadedBy))
    .where(and(eq(auditDocuments.orgId, orgId), isNull(auditDocuments.supersededBy)))
    .orderBy(desc(auditDocuments.createdAt));
  return NextResponse.json({ documents: docs });
}
