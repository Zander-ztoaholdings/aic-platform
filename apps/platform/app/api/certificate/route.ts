import { NextResponse } from 'next/server';
import { getTenantDb, organizations, issuedCertifications, eq, desc } from '@aic/db';
import { getSession } from '../../../lib/auth';
import type { Session } from 'next-auth';

export async function GET() {
  const session = await getSession() as Session | null;
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orgId = session.user.orgId;
  const db = getTenantDb(orgId);

  return await db.query(async (tx) => {
    const [org] = await tx.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
    if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

    const [cert] = await tx
      .select()
      .from(issuedCertifications)
      .where(eq(issuedCertifications.orgId, orgId))
      .orderBy(desc(issuedCertifications.createdAt))
      .limit(1);

    return NextResponse.json({
      organization: {
        name: org.name,
        slug: org.slug,
        tier: org.tier,
        integrityScore: org.integrityScore,
        primaryAiOfficer: org.primaryAiOfficer,
        certificationStatus: org.certificationStatus,
      },
      certificate: cert
        ? {
            id: cert.id,
            certNumber: cert.certNumber,
            standard: cert.standard,
            status: cert.status,
            issueDate: cert.issueDate,
            expiryDate: cert.expiryDate,
            pdfUrl: cert.pdfUrl,
            verificationCode: cert.verificationCode,
          }
        : null,
    });
  });
}
