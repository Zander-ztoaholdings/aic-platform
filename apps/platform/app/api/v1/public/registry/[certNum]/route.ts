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

  // A certificate past its expiry date is not current, whatever the stored
  // status says. Deriving this at read time means the register tells the truth
  // without depending on a scheduled job having run — and until 8 Sep 2026
  // nothing updated this table at all, so every expired certificate still
  // verified as ACTIVE.
  const storedStatus = cert.status ?? 'ACTIVE';
  const isExpired =
    !!cert.expiryDate && new Date(cert.expiryDate).getTime() < Date.now();
  const effectiveStatus =
    storedStatus === 'ACTIVE' && isExpired ? 'EXPIRED' : storedStatus;

  const isCurrent = effectiveStatus === 'ACTIVE';

  const response = NextResponse.json({
    certNumber: cert.certNumber,
    standard: cert.standard,
    status: effectiveStatus,
    // The stored value is exposed separately so a caller can tell an expired
    // certificate from one that was actively withdrawn — those mean different
    // things to anyone relying on the signal.
    storedStatus,
    isCurrent,
    issueDate: cert.issueDate,
    expiryDate: cert.expiryDate,
    withdrawnAt: cert.revokedAt ?? cert.suspendedAt ?? null,
    verificationCode: cert.verificationCode,
    organization: org ?? null,
  });

  // A verification endpoint that keeps answering ACTIVE for an hour after a
  // revocation is the failure this whole route exists to prevent, so anything
  // not currently valid is served uncached.
  response.headers.set(
    'Cache-Control',
    isCurrent ? 'public, max-age=60, s-maxage=60, must-revalidate' : 'no-store'
  );
  return response;
}
