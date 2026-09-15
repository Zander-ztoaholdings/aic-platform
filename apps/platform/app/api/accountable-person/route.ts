import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, accountablePersons, isNull, eq, and } from '@aic/db';
import { auth } from '@aic/auth';
import { canEditOrgProfile } from '@/lib/roles';
import { getClientIP } from '@/lib/rate-limit';
import crypto from 'node:crypto';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Declare (or replace) the organisation's accountable person - HU-1 (a named
 * individual, not a role) and HU-2 (they've accepted personal accountability).
 *
 * accountable_persons already existed with everything those requirements
 * need, but nothing ever wrote a row to it: /overview's Accountability panel
 * could only ever read "No current declaration on record" - the BLOCKING gap
 * deriveGaps() raises for every organisation, with no way in the product to
 * clear it.
 *
 * Rows are superseded, never overwritten (see the table's own comment), so a
 * new declaration closes out whichever row was current instead of editing or
 * deleting it - who was accountable on any given day stays answerable later.
 *
 * The wording of the acceptance checkbox in the form that posts here is a
 * placeholder, not AIC's actual legal declaration text - flagged separately
 * for Zander to confirm before an organisation relies on it for certification.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!canEditOrgProfile(session.user.role as string | undefined)) {
    return NextResponse.json(
      { error: 'Your role does not allow declaring the accountable person.' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { name, jobTitle, email, accepted } = body as {
      name?: unknown;
      jobTitle?: unknown;
      email?: unknown;
      accepted?: unknown;
    };

    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'A named individual is required.' }, { status: 400 });
    }
    if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
    }
    if (accepted !== true) {
      return NextResponse.json(
        { error: 'The declaration must be accepted to be recorded.' },
        { status: 400 }
      );
    }

    const orgId = session.user.orgId as string;
    const ip = getClientIP(request);
    const acceptedIpHash = ip ? crypto.createHash('sha256').update(ip).digest('hex') : null;
    const now = new Date();

    const db = getTenantDb(orgId);
    const person = await db.query(async (tx) => {
      // Close out whatever was current - at most one active declaration at a time.
      await tx
        .update(accountablePersons)
        .set({ supersededAt: now })
        .where(and(eq(accountablePersons.orgId, orgId), isNull(accountablePersons.supersededAt)));

      const [created] = await tx
        .insert(accountablePersons)
        .values({
          orgId,
          nominatedBy: session.user.id as string,
          name: name.trim(),
          jobTitle: typeof jobTitle === 'string' && jobTitle.trim() ? jobTitle.trim() : null,
          email: email.trim().toLowerCase(),
          declarationVersion: 'v1',
          declarationAcceptedAt: now,
          acceptedIpHash,
        })
        .returning();

      return created;
    });

    return NextResponse.json({ person }, { status: 201 });
  } catch (error) {
    console.error('[SECURITY] Accountable Person Create Error:', error);
    return NextResponse.json({ error: 'Failed to record the declaration.' }, { status: 500 });
  }
}
