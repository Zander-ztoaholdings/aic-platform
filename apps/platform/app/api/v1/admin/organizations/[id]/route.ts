import { NextRequest, NextResponse } from 'next/server';
import { getSystemDb, organizations, users, hitlLogs, eq, and, desc, sql } from '@aic/db';
import { z } from 'zod';
import { adminActor, recordAdminAction } from '@/lib/admin';

/**
 * Manage one organisation: rename, suspend access, restore access, delete.
 *
 * This replaced a PATCH that wrote whatever fields the request body contained
 * straight into the organisations row, including certification status.
 */

const Action = z.discriminatedUnion('action', [
  z.object({ action: z.literal('rename'), name: z.string().trim().min(2).max(200), reason: z.string().trim().min(3) }),
  z.object({ action: z.literal('suspend'), reason: z.string().trim().min(3) }),
  z.object({ action: z.literal('restore'), reason: z.string().trim().min(3) }),
]);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await adminActor('manage_users');
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const parsed = Action.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Give an action and a short reason.' }, { status: 400 });
  const a = parsed.data;

  const db = getSystemDb();
  const [org] = await db.select({ id: organizations.id, name: organizations.name }).from(organizations).where(eq(organizations.id, id)).limit(1);
  if (!org) return NextResponse.json({ error: 'No such organisation.' }, { status: 404 });

  if (a.action === 'rename') {
    await db.update(organizations).set({ name: a.name }).where(eq(organizations.id, id));
    await recordAdminAction({ actorId: actor.id, orgId: id, targetType: 'ADMIN_ORG', targetId: id, previous: { name: org.name }, next: { name: a.name }, reason: a.reason });
    return NextResponse.json({ ok: true });
  }

  if (a.action === 'suspend') {
    // Suspending deactivates every active member and records exactly who, so
    // restoring brings back those people and not anyone deactivated for
    // another reason.
    const deactivated = await db.update(users).set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(users.orgId, id), sql`COALESCE(${users.isActive}, true) = true`))
      .returning({ id: users.id });
    await recordAdminAction({ actorId: actor.id, orgId: id, targetType: 'ADMIN_ORG', targetId: id, previous: null, next: { suspended: true, userIds: deactivated.map((u) => u.id) }, reason: a.reason });
    return NextResponse.json({ ok: true, deactivated: deactivated.length });
  }

  // restore
  const [last] = await db.select({ next: hitlLogs.newValue }).from(hitlLogs)
    .where(and(eq(hitlLogs.targetType, 'ADMIN_ORG'), eq(hitlLogs.targetId, id), sql`${hitlLogs.newValue}->>'suspended' = 'true'`))
    .orderBy(desc(hitlLogs.createdAt)).limit(1);
  const ids = ((last?.next as { userIds?: string[] } | null)?.userIds ?? []);
  let restored = 0;
  for (const uid of ids) {
    const r = await db.update(users).set({ isActive: true, updatedAt: new Date() })
      .where(and(eq(users.id, uid), eq(users.orgId, id), sql`${users.email} NOT LIKE '%@removed.invalid'`)).returning({ id: users.id });
    restored += r.length;
  }
  await recordAdminAction({ actorId: actor.id, orgId: id, targetType: 'ADMIN_ORG', targetId: id, previous: null, next: { restored: true, count: restored }, reason: a.reason });
  return NextResponse.json({ ok: true, restored });
}

/**
 * Delete an organisation and everything filed under it. Refused when it holds
 * a certificate or an AIC Aware badge, or has members: those are records AIC
 * must keep, and members must be removed first so nobody is deleted by
 * accident. Suspend instead when in doubt.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await adminActor('manage_users');
  if (!actor?.isSuperAdmin) return NextResponse.json({ error: 'Only a super admin can delete an organisation.' }, { status: 403 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { confirmName?: string; reason?: string };

  const db = getSystemDb();
  const [org] = await db.select({ id: organizations.id, name: organizations.name }).from(organizations).where(eq(organizations.id, id)).limit(1);
  if (!org) return NextResponse.json({ error: 'No such organisation.' }, { status: 404 });
  if ((body.confirmName ?? '').trim() !== org.name) return NextResponse.json({ error: 'Type the organisation\'s name exactly to confirm.' }, { status: 400 });
  if (!body.reason || body.reason.trim().length < 3) return NextResponse.json({ error: 'Give a reason.' }, { status: 400 });

  const counts = (await db.execute(sql`
    SELECT
      (SELECT count(*)::int FROM users WHERE org_id = ${id} AND email NOT LIKE '%@removed.invalid') AS members,
      (SELECT count(*)::int FROM issued_certifications WHERE org_id = ${id}) AS certs,
      (SELECT count(*)::int FROM aware_badges WHERE org_id = ${id}) AS badges
  `)).rows[0] as { members: number; certs: number; badges: number };
  if (counts.certs > 0 || counts.badges > 0) {
    return NextResponse.json({ error: 'This organisation has certificates or AIC Aware badges on record, which AIC must keep. Suspend it instead.' }, { status: 409 });
  }
  if (counts.members > 0) {
    return NextResponse.json({ error: `Remove its ${counts.members} member account(s) first, or suspend the organisation instead.` }, { status: 409 });
  }

  try {
    await db.transaction(async (tx) => {
      // Removed (anonymised) accounts still point at the organisation.
      await tx.update(users).set({ orgId: null }).where(eq(users.orgId, id));
      await tx.delete(organizations).where(eq(organizations.id, id));
    });
  } catch (error) {
    console.error('[ADMIN] organisation delete refused by the database:', error);
    return NextResponse.json({ error: 'Other records still refer to this organisation, so it cannot be deleted. Suspend it instead.' }, { status: 409 });
  }
  await recordAdminAction({ actorId: actor.id, orgId: null, targetType: 'ADMIN_ORG', targetId: null, previous: { id, name: org.name }, next: { deleted: true }, reason: body.reason.trim() });
  return NextResponse.json({ ok: true });
}
