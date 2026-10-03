import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@aic/auth';
import { getTenantDb, awareAssessments, and, eq, sql } from '@aic/db';
import { canManageCompliance, canEditOrgProfile } from '@/lib/roles';
import { fetchAwareInstrument, sanitisePartialAnswers, lastInstrumentSource } from '@/lib/aware/instrument';
import { readAwareState, emailVerified, orgName } from '@/lib/aware/state';

export const dynamic = 'force-dynamic';

/**
 * AIC Aware inside the platform: the question set, where this organisation is
 * up to, and its current badge. Badges are issued only from here, against a
 * registered organisation with a signed accountable-person declaration — see
 * db/manual/010_aware_badges.sql for why the website stopped issuing them.
 */
export async function GET() {
  const session = await auth();
  const orgId = session?.user?.orgId as string | undefined;
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = session!.user.role as string | undefined;
  const instrument = await fetchAwareInstrument();
  const state = await getTenantDb(orgId).query((tx) => readAwareState(tx, orgId));

  return NextResponse.json({
    instrument,
    instrumentSource: lastInstrumentSource,
    ...state,
    inProgress: state.inProgress
      ? { id: state.inProgress.id, answers: state.inProgress.answers ?? {}, updatedAt: state.inProgress.updatedAt }
      : null,
    lastSubmitted: state.lastSubmitted
      ? {
          id: state.lastSubmitted.id,
          submittedAt: state.lastSubmitted.submittedAt,
          questionSetVersion: state.lastSubmitted.questionSetVersion,
          result: state.lastSubmitted.result ?? null,
        }
      : null,
    canAnswer: canManageCompliance(role),
    canDeclare: canEditOrgProfile(role),
    emailVerified: await emailVerified(session!.user.id as string),
    organisation: (await orgName(orgId)) ?? 'your organisation',
  });
}

/** Autosave. Body: { answers: Record<questionId, value> } — the whole current set. */
export async function PUT(request: NextRequest) {
  const session = await auth();
  const orgId = session?.user?.orgId as string | undefined;
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canManageCompliance(session!.user.role as string | undefined)) {
    return NextResponse.json({ error: 'Your role does not allow answering AIC Aware.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const instrument = await fetchAwareInstrument();
  const answers = sanitisePartialAnswers((body as { answers?: unknown }).answers, instrument);
  const userId = session!.user.id as string;

  const saved = await getTenantDb(orgId).query(async (tx) => {
    const [updated] = await tx
      .update(awareAssessments)
      .set({ answers, questionSetVersion: instrument.version, updatedAt: sql`now()` })
      .where(and(eq(awareAssessments.orgId, orgId), eq(awareAssessments.status, 'IN_PROGRESS')))
      .returning({ id: awareAssessments.id, updatedAt: awareAssessments.updatedAt });
    if (updated) return updated;

    const [created] = await tx
      .insert(awareAssessments)
      .values({ orgId, userId, answers, questionSetVersion: instrument.version })
      .returning({ id: awareAssessments.id, updatedAt: awareAssessments.updatedAt });
    return created;
  });

  return NextResponse.json({ ...saved, answered: Object.keys(answers).length, total: instrument.questions.length });
}
