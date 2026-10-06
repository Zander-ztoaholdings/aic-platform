import { NextRequest, NextResponse } from 'next/server';
import { getSystemDb, organizations, conflictChecks, and, eq, isNull } from '@aic/db';
import { z } from 'zod';
import { adminActor, recordAdminAction } from '@/lib/admin';
import { recordFileHolder } from '@/lib/assignments';

/**
 * An assessor takes an unassigned file, or confirms one assigned to them, by
 * declaring any conflict of interest first. The declaration is kept
 * (conflict_checks), so "who assessed this, and were they independent?" has a
 * recorded answer. A declared advisory relationship in the last two years
 * blocks the claim: under AIC's impartiality rules that assessor cannot
 * certify the organisation.
 */
const Body = z.object({
  priorAdvisory: z.boolean(),
  lastAdvisoryDate: z.string().date().nullable().optional(),
  declaration: z.string().trim().max(2000).optional(),
});

const TWO_YEARS = 2 * 365 * 24 * 3600 * 1000;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await adminActor('conduct_assessment');
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'No such organisation.' }, { status: 404 });
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Answer the conflict question first.' }, { status: 400 });
  const b = parsed.data;

  const db = getSystemDb();
  const [org] = await db.select({ id: organizations.id, name: organizations.name, auditorId: organizations.auditorId }).from(organizations).where(eq(organizations.id, id)).limit(1);
  if (!org) return NextResponse.json({ error: 'No such organisation.' }, { status: 404 });
  if (org.auditorId && org.auditorId !== actor.id) return NextResponse.json({ error: 'Another assessor holds this file. Ask a super admin to reassign it.' }, { status: 409 });

  // A declared conflict stands: answering differently a minute later does not clear it.
  const [blocked] = await db.select({ id: conflictChecks.id }).from(conflictChecks)
    .where(and(eq(conflictChecks.orgId, id), eq(conflictChecks.auditorId, actor.id), eq(conflictChecks.status, 'BLOCKED'))).limit(1);
  if (blocked) return NextResponse.json({ error: 'You declared a conflict with this organisation, so you cannot take the file. A super admin can review the declaration.' }, { status: 409 });

  const recent = b.priorAdvisory && (!b.lastAdvisoryDate || Date.now() - new Date(b.lastAdvisoryDate).getTime() < TWO_YEARS);
  await db.insert(conflictChecks).values({
    orgId: id, auditorId: actor.id,
    declaration: b.declaration || (b.priorAdvisory ? 'Declared a prior advisory relationship.' : 'No prior advisory or commercial relationship with this organisation.'),
    hasPriorAdvisoryRelationship: b.priorAdvisory,
    lastAdvisoryDate: b.lastAdvisoryDate ? new Date(b.lastAdvisoryDate) : null,
    isCleared: !recent,
    status: recent ? 'BLOCKED' : 'CLEARED',
  });
  if (recent) {
    return NextResponse.json({ error: 'You advised this organisation in the last two years, so you cannot assess it. The declaration has been recorded; a super admin will assign someone else.' }, { status: 409 });
  }

  const [claimed] = await db.update(organizations).set({ auditorId: actor.id })
    .where(and(eq(organizations.id, id), org.auditorId ? eq(organizations.auditorId, actor.id) : isNull(organizations.auditorId)))
    .returning({ id: organizations.id });
  if (!claimed) return NextResponse.json({ error: 'Someone took this file a moment ago.' }, { status: 409 });
  await recordAdminAction({ actorId: actor.id, orgId: id, targetType: 'ADMIN_ORG', targetId: id, previous: { auditorId: org.auditorId }, next: { auditorId: actor.id, conflictCheck: 'cleared' }, reason: 'Assessor took the file after a conflict declaration' });
  await recordFileHolder(id, actor.id, actor.id, 'Took the file after a conflict declaration');
  return NextResponse.json({ ok: true });
}
