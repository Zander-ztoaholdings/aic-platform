import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, accessReviews, accessReviewItems, eq, desc } from '@aic/db';
import { orgCaller, guarded } from '@/lib/registers/caller';
import { listAccounts } from '@/lib/registers/accounts';

export const dynamic = 'force-dynamic';

export async function GET() {
  const c = await orgCaller();
  if ('error' in c) return c.error;
  return guarded('016', async () => {
    const { reviews, items } = await getTenantDb(c.orgId).query(async (tx) => ({
      reviews: await tx.select().from(accessReviews).where(eq(accessReviews.orgId, c.orgId)).orderBy(desc(accessReviews.createdAt)),
      items: await tx.select({ reviewId: accessReviewItems.reviewId, decision: accessReviewItems.decision, removedAt: accessReviewItems.removedAt }).from(accessReviewItems).where(eq(accessReviewItems.orgId, c.orgId)),
    }));
    return NextResponse.json({
      canManage: c.canManage,
      reviews: reviews.map((r) => {
        const mine = items.filter((i) => i.reviewId === r.id);
        return { ...r, total: mine.length, decided: mine.filter((i) => i.decision).length, removals: mine.filter((i) => i.decision === 'remove' || i.decision === 'reduce').length, removed: mine.filter((i) => i.removedAt).length };
      }),
    });
  });
}

/** Start a review: every account AIC can see in the connected systems, as of now. */
export async function POST(request: NextRequest) {
  const c = await orgCaller({ manage: true });
  if ('error' in c) return c.error;
  const b = (await request.json().catch(() => ({}))) as { name?: unknown; dueAt?: unknown; systems?: unknown };
  const name = typeof b.name === 'string' && b.name.trim() ? b.name.trim().slice(0, 200) : `Access review, ${new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`;
  const dueAt = typeof b.dueAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.dueAt) ? new Date(b.dueAt + 'T23:59:59Z') : new Date(Date.now() + 14 * 86_400_000);
  const { accounts, notes } = await listAccounts(c.orgId);
  const only = Array.isArray(b.systems) && b.systems.length ? new Set(b.systems as string[]) : null;
  const chosen = accounts.filter((a) => !only || only.has(a.system));
  if (!chosen.length) return NextResponse.json({ error: notes[0] ?? 'AIC cannot see any accounts yet. Connect Microsoft 365, Google Workspace, Okta or GitHub first.' }, { status: 400 });
  return guarded('016', async () => {
    const id = await getTenantDb(c.orgId).query(async (tx) => {
      const [r] = await tx.insert(accessReviews).values({ orgId: c.orgId, name, dueAt, createdBy: c.userId }).returning({ id: accessReviews.id });
      for (let i = 0; i < chosen.length; i += 500) {
        await tx.insert(accessReviewItems).values(chosen.slice(i, i + 500).map((a) => ({
          reviewId: r.id, orgId: c.orgId, system: a.system, account: a.account, displayName: a.displayName, privilege: a.privilege,
          lastActiveAt: a.lastActiveAt ? new Date(a.lastActiveAt) : null,
        })));
      }
      return r.id;
    });
    return NextResponse.json({ id, accounts: chosen.length, notes }, { status: 201 });
  });
}
