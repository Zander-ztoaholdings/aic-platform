import { NextResponse } from 'next/server';
import { controlFromSlot } from '@/lib/common-controls';
import { getTenantDb, auditRequirements, auditDocuments, organizations, eq, asc, desc } from '@aic/db';
import { auth } from '@aic/auth';
import { fetchPublishedStandard, type PublishedStandard } from '@/lib/standard';
import { canManageCompliance } from '@/lib/roles';
import { evidenceState, summariseByRight, type VaultRequirement } from '@/lib/evidence-vault';

/** The organisation's requirements and the evidence filed against each. Counts only, no score. */
export async function GET() {
  const session = await auth();
  const orgId = session?.user?.orgId as string | undefined;
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let standard: PublishedStandard | null = null;
  try {
    standard = await fetchPublishedStandard();
  } catch {
    standard = null;
  }
  const tierOf = new Map((standard?.requirements ?? []).map((r) => [r.code, r.tier]));

  const db = getTenantDb(orgId);
  const { org, reqs, docs } = await db.query(async (tx) => {
    const [org] = await tx
      .select({ division: organizations.division, standardVersion: organizations.standardVersion })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);
    const reqs = await tx.select().from(auditRequirements).where(eq(auditRequirements.orgId, orgId)).orderBy(asc(auditRequirements.code), asc(auditRequirements.createdAt));
    const docs = await tx.select().from(auditDocuments).where(eq(auditDocuments.orgId, orgId)).orderBy(desc(auditDocuments.createdAt));
    return { org, reqs, docs };
  });

  const requirements: VaultRequirement[] = reqs.map((r) => {
    const mine = docs
      .filter((d) => d.requirementId === r.id)
      .map((d) => ({
        id: d.id,
        title: d.title,
        fileSize: d.fileSize,
        createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
        verificationOutcome: d.verificationOutcome,
        verificationNotes: d.verificationNotes,
        verifiedAt: d.verifiedAt ? new Date(d.verifiedAt).toISOString() : null,
        supersededBy: d.supersededBy,
      }));
    return {
      id: r.id,
      code: r.code,
      rightCode: r.rightCode ?? r.category,
      text: r.title,
      evidenceGuidance: r.evidenceGuidance,
      tier: r.code ? tierOf.get(r.code) ?? null : null,
      state: evidenceState(mine),
      documents: mine,
    };
  });

  const unlinked = docs.filter((d) => !d.requirementId && !controlFromSlot(d.slotType)).map((d) => ({
    id: d.id, title: d.title, createdAt: d.createdAt, slotType: d.slotType,
  }));

  return NextResponse.json({
    division: org?.division ?? null,
    standardVersion: org?.standardVersion ?? standard?.version ?? null,
    canSubmit: canManageCompliance(session?.user?.role as string | undefined),
    canSeed: reqs.length === 0 && !!org?.division && canManageCompliance(session?.user?.role as string | undefined),
    rights: summariseByRight(requirements, standard?.rights),
    tiers: standard?.tiers ?? null,
    requirements,
    unlinked,
  });
}
