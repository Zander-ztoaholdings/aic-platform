import { NextRequest, NextResponse } from 'next/server';
import { getSystemDb, issuedCertifications, organizations, hitlLogs, eq } from '@aic/db';
import { auth } from '@aic/auth';
import { hasCapability } from '@/lib/rbac';
import { z } from 'zod';

/**
 * Certificate lifecycle: suspend, reinstate, revoke.
 *
 * Until 8 Sep 2026 no code path anywhere in this repo updated
 * issued_certifications — `update(issuedCertifications)` returned nothing
 * across the whole codebase. A certificate could be issued and never withdrawn.
 * It stayed ACTIVE past its own expiry date, and the public register kept
 * saying so. A register that can only add rows is worse than no register,
 * because it makes a stale or withdrawn certificate look current indefinitely.
 *
 * Every transition here records who did it, when, and why. That is not
 * ceremony: "on what basis was this certificate withdrawn" is a question an
 * accreditation body, an insurer relying on the signal, and the affected
 * organisation are all entitled to ask, and it has to be answerable from the
 * record rather than from memory.
 */

const ActionSchema = z.object({
  action: z.enum(['SUSPEND', 'REINSTATE', 'REVOKE']),
  // No withdrawal without a stated reason. The database enforces this too.
  reason: z.string().min(10, 'A reason of at least 10 characters is required').max(2000),
});

// What each action may be applied to. REVOKED is terminal by design: a revoked
// certificate is not un-revoked, a new one is issued after a fresh assessment.
const ALLOWED_FROM: Record<string, string[]> = {
  SUSPEND:   ['ACTIVE'],
  REINSTATE: ['SUSPENDED'],
  REVOKE:    ['ACTIVE', 'SUSPENDED'],
};

const RESULTING_STATUS: Record<string, string> = {
  SUSPEND: 'SUSPENDED',
  REINSTATE: 'ACTIVE',
  REVOKE: 'REVOKED',
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ certNumber: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const authorized = await hasCapability(session.user.id, 'manage_certification_lifecycle');
  if (!authorized) {
    return NextResponse.json(
      { error: 'Forbidden', message: 'Missing capability: manage_certification_lifecycle' },
      { status: 403 }
    );
  }

  try {
    const { certNumber } = await params;
    const { action, reason } = ActionSchema.parse(await request.json());

    const db = getSystemDb();

    return await db.transaction(async (tx) => {
      const [cert] = await tx
        .select()
        .from(issuedCertifications)
        .where(eq(issuedCertifications.certNumber, certNumber))
        .limit(1);

      if (!cert) {
        return NextResponse.json({ error: 'Certificate not found' }, { status: 404 });
      }

      const current = cert.status ?? 'ACTIVE';
      if (!ALLOWED_FROM[action].includes(current)) {
        return NextResponse.json({
          error: 'Invalid lifecycle transition',
          message: `Cannot ${action.toLowerCase()} a certificate whose status is ${current}.`,
          allowedFrom: ALLOWED_FROM[action],
        }, { status: 400 });
      }

      const now = new Date();
      const actor = session.user.id as string;
      const next = RESULTING_STATUS[action];

      // Written as explicit branches rather than a dynamic object so the column
      // set stays type-checked against the schema.
      const [updated] = await tx
        .update(issuedCertifications)
        .set(
          action === 'SUSPEND'
            ? {
                status: next,
                updatedAt: now,
                suspendedAt: now,
                suspendedBy: actor,
                suspensionReason: reason,
              }
            : action === 'REVOKE'
            ? {
                status: next,
                updatedAt: now,
                revokedAt: now,
                revokedBy: actor,
                revocationReason: reason,
              }
            : {
                // The suspension that was lifted stays on the record. Clearing
                // it would erase the history of the certificate ever having
                // been suspended.
                status: next,
                updatedAt: now,
                reinstatedAt: now,
                reinstatedBy: actor,
              }
        )
        .where(eq(issuedCertifications.id, cert.id))
        .returning();

      // A suspended or revoked organisation comes off the public directory.
      if (cert.orgId) {
        await tx
          .update(organizations)
          .set({ publicDirectoryVisible: action === 'REINSTATE' })
          .where(eq(organizations.id, cert.orgId));
      }

      await tx.insert(hitlLogs).values({
        actorId: actor,
        targetType: 'CERTIFICATION_LIFECYCLE',
        targetId: cert.id,
        previousValue: { status: current },
        newValue: { status: next, certNumber: cert.certNumber },
        overrideReason: reason,
      });

      return NextResponse.json({
        success: true,
        certNumber: cert.certNumber,
        previousStatus: current,
        status: next,
        certificate: updated,
      });
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', issues: error.issues }, { status: 400 });
    }
    console.error('[CERT_LIFECYCLE_ERROR]', error);
    return NextResponse.json({ error: 'Lifecycle transition failed' }, { status: 500 });
  }
}
