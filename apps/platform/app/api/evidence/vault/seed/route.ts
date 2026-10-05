import { NextResponse } from 'next/server';
import { getTenantDb, auditRequirements, organizations, eq } from '@aic/db';
import { auth } from '@aic/auth';
import { fetchPublishedStandard, requirementsForDivision } from '@/lib/standard';
import { canManageCompliance } from '@/lib/roles';

/**
 * For an organisation registered before requirements were seeded at signup:
 * load the requirements that apply to its Division from the published
 * standard. Refuses if any requirement already exists, so it can never
 * duplicate or overwrite a roadmap.
 */
export async function POST() {
  const session = await auth();
  const orgId = session?.user?.orgId as string | undefined;
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canManageCompliance(session?.user?.role as string | undefined)) {
    return NextResponse.json({ error: 'Your role cannot change the requirement set.' }, { status: 403 });
  }

  let standard;
  try {
    standard = await fetchPublishedStandard();
  } catch {
    return NextResponse.json({ error: 'The published standard could not be loaded. Try again shortly.' }, { status: 503 });
  }

  const db = getTenantDb(orgId);
  const result = await db.query(async (tx) => {
    const [org] = await tx.select({ division: organizations.division }).from(organizations).where(eq(organizations.id, orgId)).limit(1);
    if (!org?.division) return { error: 'Your organisation has no Division recorded. Contact AIC to set it.', status: 400 } as const;
    const existing = await tx.select({ id: auditRequirements.id }).from(auditRequirements).where(eq(auditRequirements.orgId, orgId)).limit(1);
    if (existing.length > 0) return { error: 'Your requirements are already loaded.', status: 409 } as const;
    const applicable = requirementsForDivision(standard, org.division);
    for (const r of applicable) {
      await tx.insert(auditRequirements).values({
        orgId, code: r.code, rightCode: r.right, category: r.right, title: r.text,
        evidenceGuidance: r.evidence, standardVersion: standard.version, status: 'PENDING',
      });
    }
    await tx.update(organizations).set({ standardVersion: standard.version }).where(eq(organizations.id, orgId));
    return { loaded: applicable.length } as const;
  });
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
