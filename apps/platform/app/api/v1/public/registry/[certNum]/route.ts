import { NextRequest, NextResponse } from 'next/server';
import { getSystemDb, issuedCertifications, organizations, eq } from '@aic/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ certNum: string }> }
) {
  const { certNum } = await params;

  if (!certNum || certNum.length > 64) {
    return NextResponse.json({ error: 'Invalid certificate number' }, { status: 400 });
  }

  const db = getSystemDb();

  const [cert] = await db
    .select()
    .from(issuedCertifications)
    .where(eq(issuedCertifications.certNumber, certNum))
    .limit(1);

  if (!cert) {
    return NextResponse.json({ error: 'Certificate not found' }, { status: 404 });
  }

  let org: { name: string; slug: string | null; tier: string | null } | null = null;
  if (cert.orgId) {
    const [row] = await db
      .select({ name: organizations.name, slug: organizations.slug, tier: organizations.tier })
      .from(organizations)
      .where(eq(organizations.id, cert.orgId))
      .limit(1);
    org = row ?? null;
  }

  const response = NextResponse.json({
    certNumber: cert.certNumber,
    standard: cert.standard,
    status: cert.status,
    issueDate: cert.issueDate,
    expiryDate: cert.expiryDate,
    verificationCode: cert.verificationCode,
    organization: org ?? null,
  });

  response.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  return response;
}
