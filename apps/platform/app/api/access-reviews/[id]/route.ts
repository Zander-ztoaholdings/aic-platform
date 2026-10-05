import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, accessReviews, accessReviewItems, orgPeople, users, and, eq, inArray } from '@aic/db';
import { orgCaller, guarded } from '@/lib/registers/caller';
import { isUuid } from '@/lib/policy-hash';
import { matchesPerson } from '@/lib/registers/accounts';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_r: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const c = await orgCaller();
  if ('error' in c) return c.error;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return guarded('016', async () => {
    const { review, items, people, staff } = await getTenantDb(c.orgId).query(async (tx) => ({
      review: (await tx.select().from(accessReviews).where(and(eq(accessReviews.id, id), eq(accessReviews.orgId, c.orgId))).limit(1))[0],
      items: await tx.select().from(accessReviewItems).where(and(eq(accessReviewItems.reviewId, id), eq(accessReviewItems.orgId, c.orgId))),
      people: await tx.select({ id: users.id, name: users.name }).from(users).where(eq(users.orgId, c.orgId)),
      staff: await tx.select({ name: orgPeople.name, email: orgPeople.email, endDate: orgPeople.endDate }).from(orgPeople).where(eq(orgPeople.orgId, c.orgId)),
    }));
    if (!review) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const who = new Map(people.map((p) => [p.id, p.name]));
    const today = new Date().toISOString().slice(0, 10);
    // Match each account to someone on the people list, so a reviewer sees who has left and which accounts belong to nobody known.
    const owner = (i: typeof items[number]) => {
      const p = staff.find((s) => matchesPerson({ system: i.system, account: i.account, displayName: i.displayName, privilege: null, lastActiveAt: null, enabled: true }, s));
      return p ? { name: p.name, leftOn: p.endDate && p.endDate < today ? p.endDate : null } : null;
    };
    return NextResponse.json({
      review, canManage: c.canManage,
      hasPeople: staff.length > 0,
      items: items.map((i) => ({ ...i, decidedByName: i.decidedBy ? who.get(i.decidedBy) ?? null : null, person: owner(i) }))
        .sort((a, b) => a.system.localeCompare(b.system) || (b.privilege ?? '').localeCompare(a.privilege ?? '') || a.account.localeCompare(b.account)),
    });
  });
}

/**
 * Decide on accounts ({ itemIds, decision, note }), mark removals done
 * ({ itemIds, removed: true }), or complete the review ({ complete: true }).
 * A review completes only when every account has a decision.
 */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const c = await orgCaller({ manage: true });
  if ('error' in c) return c.error;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const b = (await request.json().catch(() => ({}))) as { itemIds?: unknown; decision?: unknown; note?: unknown; removed?: unknown; complete?: unknown };
  return guarded('016', async () => {
    const db = getTenantDb(c.orgId);
    const [review] = await db.query((tx) => tx.select().from(accessReviews).where(and(eq(accessReviews.id, id), eq(accessReviews.orgId, c.orgId))).limit(1));
    if (!review) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const now = new Date();
    if (b.complete === true) {
      const open = await db.query((tx) => tx.select({ id: accessReviewItems.id, decision: accessReviewItems.decision }).from(accessReviewItems).where(eq(accessReviewItems.reviewId, id)));
      const undecided = open.filter((i) => !i.decision).length;
      if (undecided) return NextResponse.json({ error: `${undecided} account${undecided === 1 ? '' : 's'} still need a decision.` }, { status: 409 });
      await db.query((tx) => tx.update(accessReviews).set({ status: 'completed', completedAt: now, completedBy: c.userId }).where(eq(accessReviews.id, id)));
      return NextResponse.json({ ok: true });
    }
    const ids = Array.isArray(b.itemIds) ? (b.itemIds as unknown[]).filter((x): x is string => typeof x === 'string' && isUuid(x)).slice(0, 1000) : [];
    if (!ids.length) return NextResponse.json({ error: 'Choose at least one account.' }, { status: 400 });
    if (b.removed === true) {
      await db.query((tx) => tx.update(accessReviewItems).set({ removedAt: now }).where(and(eq(accessReviewItems.reviewId, id), inArray(accessReviewItems.id, ids))));
      return NextResponse.json({ ok: true });
    }
    if (review.status !== 'open') return NextResponse.json({ error: 'This review is complete. Start a new one to change decisions.' }, { status: 409 });
    if (!['keep', 'remove', 'reduce'].includes(b.decision as string)) return NextResponse.json({ error: 'Choose keep, remove or reduce.' }, { status: 400 });
    const note = typeof b.note === 'string' && b.note.trim() ? b.note.trim().slice(0, 1000) : null;
    await db.query((tx) => tx.update(accessReviewItems).set({ decision: b.decision as string, note, decidedBy: c.userId, decidedAt: now, removedAt: null })
      .where(and(eq(accessReviewItems.reviewId, id), inArray(accessReviewItems.id, ids))));
    return NextResponse.json({ ok: true });
  });
}
