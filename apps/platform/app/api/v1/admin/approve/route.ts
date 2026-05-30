import { NextRequest, NextResponse } from 'next/server';
import { getSystemDb, organizations, issuedCertifications, eq } from '@aic/db';
import { auth } from '@aic/auth';
import { isValidTransition } from '@/lib/state-machine';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

    // 3. Generate unique Cert Number
    const certNumber = `AIC-${Math.random().toString(36).substring(2, 10).toUpperCase()}-2026`;

    // 4. Issue Certificate in Transaction
    await db.transaction(async (tx) => {
      const expiry = new Date();
      expiry.setFullYear(expiry.getFullYear() + 3);

      await tx.insert(issuedCertifications).values({
        orgId,
        certNumber,
        issueDate: new Date(),
        expiryDate: expiry,
        status: 'ACTIVE',
        verificationCode: Math.random().toString(36).substring(7).toUpperCase()
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
