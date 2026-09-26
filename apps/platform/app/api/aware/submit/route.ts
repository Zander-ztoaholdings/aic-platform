import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@aic/auth';
import { getTenantDb, awareAssessments, awareBadges, and, eq, isNull } from '@aic/db';
import { canEditOrgProfile } from '@/lib/roles';
import { fetchAwareInstrument, validateCompleteAnswers, scoreWithPublisher } from '@/lib/aware/instrument';
import { generateBadgeCode, badgeExpiry } from '@/lib/aware/badge';
import { readAwareState, orgName } from '@/lib/aware/state';

export const dynamic = 'force-dynamic';

/**
 * Submit AIC Aware and issue the badge.
 *
 * Preconditions, all checked here rather than trusted from the page: a current
 * accountable-person declaration (HU-1/HU-2), every question answered against
 * the current published question set, and an explicit attestation by the
 * submitting user. A badge replaces — and revokes, with a recorded reason —
 * whatever badge the organisation held before, so exactly one is ever live.
 *
 * AIC Aware is a self-declaration. The badge says so on its verify page; it is
 * not a certificate and is never presented as one.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  const orgId = session?.user?.orgId as string | undefined;
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canEditOrgProfile(session!.user.role as string | undefined)) {
    return NextResponse.json({ error: 'Your role does not allow submitting on behalf of the organisation.' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { attested?: unknown };
  if (body.attested !== true) {
    return NextResponse.json({ error: 'The declaration must be confirmed before submitting.' }, { status: 400 });
  }

  const userId = session!.user.id as string;
  const instrument = await fetchAwareInstrument();
  const name = await orgName(orgId);
  if (!name) return NextResponse.json({ error: 'Organisation not found.' }, { status: 404 });

  const db = getTenantDb(orgId);
  const pre = await db.query((tx) => readAwareState(tx, orgId));

  if (!pre.accountablePerson) {
    return NextResponse.json(
      { error: 'Name your accountable person before submitting. AIC Aware is declared by a named individual, not a role.' },
      { status: 409 }
    );
  }
  if (!pre.inProgress) {
    return NextResponse.json({ error: 'There is no AIC Aware in progress to submit.' }, { status: 409 });
  }

  const answers = (pre.inProgress.answers ?? {}) as Record<string, number>;
  const problems = validateCompleteAnswers(answers, instrument);
  if (problems.length > 0) {
    return NextResponse.json({ error: 'Some questions still need an answer.', problems }, { status: 400 });
  }

  // Scored by the publisher, outside the transaction. Null when unreachable:
  // the badge rests on the declaration, and no number is invented to fill in.
  const result = await scoreWithPublisher(answers, instrument.version);

  const issuedAt = new Date();
  const expiresAt = badgeExpiry(issuedAt);

  try {
    const issued = await db.query(async (tx) => {
      const [submitted] = await tx
        .update(awareAssessments)
        .set({
          status: 'SUBMITTED',
          questionSetVersion: instrument.version,
          submittedAt: issuedAt,
          updatedAt: issuedAt,
          attestedAt: issuedAt,
          attestedBy: userId,
          score: result?.score ?? null,
          indicatedDivision: result?.indicatedDivision != null ? String(result.indicatedDivision) : null,
          result: result ?? null,
        })
        .where(and(eq(awareAssessments.id, pre.inProgress!.id), eq(awareAssessments.status, 'IN_PROGRESS')))
        .returning({ id: awareAssessments.id });
      if (!submitted) throw new ConflictError();

      const [previous] = await tx
        .update(awareBadges)
        .set({ revokedAt: issuedAt, revokedBy: userId, revocationReason: 'Superseded by a later declaration' })
        .where(and(eq(awareBadges.orgId, orgId), isNull(awareBadges.revokedAt)))
        .returning({ listed: awareBadges.listed, expiresAt: awareBadges.expiresAt });

      // Directory listing is the organisation's choice and carries over to the new badge.
      const listed = !!previous?.listed;

      // A collision in 40 bits is vanishingly unlikely; the unique index is the
      // backstop and a retry makes it a non-event.
      for (let attempt = 0; attempt < 3; attempt++) {
        const code = generateBadgeCode();
        const [clash] = await tx.select({ id: awareBadges.id }).from(awareBadges).where(eq(awareBadges.code, code)).limit(1);
        if (clash) continue;
        const [badge] = await tx
          .insert(awareBadges)
          .values({
            code,
            orgId,
            assessmentId: submitted.id,
            accountablePersonId: pre.accountablePerson!.id,
            issuedBy: userId,
            orgNameAtIssue: name,
            questionSetVersion: instrument.version,
            listed,
            issuedAt,
            expiresAt,
          })
          .returning();
        return badge;
      }
      throw new Error('Could not allocate a unique badge code');
    });

    return NextResponse.json({ badge: issued, result, scored: !!result }, { status: 201 });
  } catch (error) {
    if (error instanceof ConflictError) {
      return NextResponse.json({ error: 'This AIC Aware was already submitted.' }, { status: 409 });
    }
    console.error('[AWARE] submit failed:', error);
    return NextResponse.json({ error: 'Could not submit AIC Aware.' }, { status: 500 });
  }
}

class ConflictError extends Error {}

