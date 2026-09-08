import { NextRequest, NextResponse } from 'next/server';
import { getSystemDb, organizations, issuedCertifications, eq } from '@aic/db';
import { auth } from '@aic/auth';
import { isValidTransition } from '@/lib/state-machine';
import { hasCapability } from '@/lib/rbac';
import { randomBytes } from 'crypto';

/**
 * Issues an AIC certificate and makes the organisation publicly visible on the
 * register.
 *
 * Until 8 Sep 2026 this route checked only that SOMEBODY was logged in. Since
 * /api/signup makes the first user of every self-registered organisation an
 * org-level ADMIN, any account holder could POST an arbitrary orgId here and
 * issue themselves — or anyone else — a certificate that then appeared on the
 * public register. A register a stranger can write to is worth less than no
 * register at all, so this is now gated on an explicit capability. While the
 * capability tables are unseeded, hasCapability() grants only super-admins,
 * which is the correct population for certification decisions today.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const authorized = await hasCapability(session.user.id, 'issue_certification');
  if (!authorized) {
    return NextResponse.json(
      { error: 'Forbidden', message: 'Missing capability: issue_certification' },
      { status: 403 }
    );
  }

  try {
    const { orgId } = await req.json();
    const db = getSystemDb();

    // 1. Fetch current status
    const [org] = await db
      .select({ status: organizations.certificationStatus })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 404 });

    // 2. Validate Transition
    if (!isValidTransition(org.status as any, 'APPROVED')) {
      return NextResponse.json({ 
        error: 'Invalid Lifecycle Transition',
        message: `Cannot transition from ${org.status} to APPROVED.`
      }, { status: 400 });
    }

    // 3. Generate unique Cert Number.
    // Was Math.random() with the year hardcoded to 2026 and no collision check.
    // The verification code was Math.random().toString(36).substring(7) — about
    // five guessable characters guarding the one thing a third party uses to
    // confirm a certificate is real. Both are now crypto-random.
    const issueDate = new Date();
    const certNumber = `AIC-${randomBytes(5).toString('hex').toUpperCase()}-${issueDate.getFullYear()}`;
    const verificationCode = randomBytes(16).toString('hex').toUpperCase();

    // 4. Issue Certificate in Transaction
    await db.transaction(async (tx) => {
      const [collision] = await tx
        .select({ id: issuedCertifications.id })
        .from(issuedCertifications)
        .where(eq(issuedCertifications.certNumber, certNumber))
        .limit(1);
      if (collision) throw new Error('Certificate number collision — retry issuance');

      // ⚠️ UNRESOLVED SCHEME POLICY: validity period is stated three different
      // ways across AIC's own material — 12 months in the certification
      // playbook, Division-calibrated 12–24 months in aic-web's
      // lib/assessment.ts, and 3 years here. Left as-is deliberately rather
      // than silently picking one; this is a scheme decision, not a bug fix.
      const expiry = new Date(issueDate);
      expiry.setFullYear(expiry.getFullYear() + 3);

      await tx.insert(issuedCertifications).values({
        orgId,
        certNumber,
        issueDate,
        expiryDate: expiry,
        status: 'ACTIVE',
        verificationCode
      });

      // [SECURITY] Record High-Stakes HITL Event
      const { hitlLogs } = await import('@aic/db');
      await tx.insert(hitlLogs).values({
        actorId: session.user.id,
        targetType: 'CERTIFICATION_ISSUANCE',
        targetId: orgId,
        previousValue: { status: org.status },
        newValue: { status: 'APPROVED', certNumber },
        overrideReason: 'Final institutional audit verification complete.'
      });

      await tx.update(organizations)
        .set({ 
          certificationStatus: 'APPROVED',
          publicDirectoryVisible: true
        })
        .where(eq(organizations.id, orgId));
    });

    return NextResponse.json({ 
      success: true, 
      certNumber, 
      message: 'Certification factory finalized issuance.' 
    });

  } catch (error) {
    console.error('[APPROVE_API_ERROR]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
