import { NextResponse } from 'next/server';
import { getSystemDb, issuedCertifications, organizations, eq, desc } from '@aic/db';
import { adminActor } from '@/lib/admin';
import { hasCapability } from '@/lib/rbac';

/** Every certificate AIC has issued, with its organisation. Read by the staff Certifications page. */
export async function GET() {
  const actor = await adminActor('conduct_assessment');
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const rows = await getSystemDb()
    .select({
      id: issuedCertifications.id,
      certNumber: issuedCertifications.certNumber,
      standard: issuedCertifications.standard,
      status: issuedCertifications.status,
      issueDate: issuedCertifications.issueDate,
      expiryDate: issuedCertifications.expiryDate,
      suspensionReason: issuedCertifications.suspensionReason,
      revocationReason: issuedCertifications.revocationReason,
      organisation: organizations.name,
      division: organizations.division,
    })
    .from(issuedCertifications)
    .leftJoin(organizations, eq(organizations.id, issuedCertifications.orgId))
    .orderBy(desc(issuedCertifications.issueDate));
  return NextResponse.json({
    certificates: rows,
    canManageLifecycle: await hasCapability(actor.id, 'manage_certification_lifecycle'),
  });
}
