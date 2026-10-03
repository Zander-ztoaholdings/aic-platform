import { NextRequest, NextResponse } from 'next/server';
import { getSystemDb, users, organizations, eq, and, sql } from '@aic/db';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { adminActor, recordAdminAction, ROLES, isStaffRole } from '@/lib/admin';

/**
 * Manage one account: change role, grant or remove super admin, move between
 * organisations, deactivate, reactivate, unlock, or remove.
 *
 * Changes reach the person's open session within a minute (the session
 * re-reads the account; see @aic/auth). Every change is recorded with a reason.
 *
 * Guard rails: nobody can change their own role, super-admin status or active
 * state (so an admin cannot lock themselves out by accident), and the last
 * active super admin cannot be demoted, deactivated or removed.
 */

const Action = z.discriminatedUnion('action', [
  z.object({ action: z.literal('set_role'), role: z.enum(ROLES), reason: z.string().trim().min(3) }),
  z.object({ action: z.literal('set_super_admin'), value: z.boolean(), reason: z.string().trim().min(3) }),
  z.object({ action: z.literal('move_org'), orgId: z.string().uuid().nullable(), reason: z.string().trim().min(3) }),
  z.object({ action: z.literal('deactivate'), reason: z.string().trim().min(3) }),
  z.object({ action: z.literal('reactivate'), reason: z.string().trim().min(3) }),
  z.object({ action: z.literal('unlock'), reason: z.string().trim().min(3) }),
]);

async function activeSuperAdmins(): Promise<number> {
  const r = await getSystemDb().execute(sql`SELECT count(*)::int AS n FROM users WHERE is_super_admin = true AND COALESCE(is_active, true) = true`);
  return Number((r.rows[0] as { n: number }).n);
}

async function load(id: string) {
  const [u] = await getSystemDb().select().from(users).where(eq(users.id, id)).limit(1);
  return u ?? null;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await adminActor('manage_users');
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;

  const parsed = Action.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Give an action and a short reason.' }, { status: 400 });
  const a = parsed.data;

  const target = await load(id);
  if (!target) return NextResponse.json({ error: 'No such account.' }, { status: 404 });
  if (id === actor.id && a.action !== 'unlock') {
    return NextResponse.json({ error: 'You cannot change your own account here. Ask another super admin.' }, { status: 400 });
  }
  const touchesSuper = a.action === 'set_super_admin' || (a.action === 'set_role' && (a.role === 'AIC_SUPER_ADMIN' || target.isSuperAdmin));
  if ((touchesSuper || target.isSuperAdmin) && !actor.isSuperAdmin) {
    return NextResponse.json({ error: 'Only a super admin can change a super admin, or make one.' }, { status: 403 });
  }
  const removesLastSuper =
    target.isSuperAdmin && target.isActive !== false &&
    ((a.action === 'set_super_admin' && !a.value) || a.action === 'deactivate' || (a.action === 'set_role' && a.role !== 'AIC_SUPER_ADMIN'));
  if (removesLastSuper && (await activeSuperAdmins()) <= 1) {
    return NextResponse.json({ error: 'This is the last active super admin. Make someone else a super admin first.' }, { status: 409 });
  }

  const db = getSystemDb();
  const before = { role: target.role, isSuperAdmin: target.isSuperAdmin, orgId: target.orgId, isActive: target.isActive };
  let set: Partial<typeof users.$inferInsert> = {};

  switch (a.action) {
    case 'set_role': {
      if (!isStaffRole(a.role) && !target.orgId) {
        return NextResponse.json({ error: 'Move this account into an organisation before giving it a client role.' }, { status: 400 });
      }
      // The label and the gate move together, as lib/roles.ts requires.
      set = { role: a.role, isSuperAdmin: a.role === 'AIC_SUPER_ADMIN', ...(isStaffRole(a.role) ? { orgId: null } : {}) };
      break;
    }
    case 'set_super_admin':
      set = a.value ? { isSuperAdmin: true, role: 'AIC_SUPER_ADMIN', orgId: null } : { isSuperAdmin: false, role: 'AIC_AUDITOR' };
      break;
    case 'move_org': {
      if (a.orgId) {
        const [org] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, a.orgId)).limit(1);
        if (!org) return NextResponse.json({ error: 'No such organisation.' }, { status: 404 });
        if (isStaffRole(target.role ?? '')) return NextResponse.json({ error: 'Staff accounts do not belong to a client organisation. Change the role first.' }, { status: 400 });
      } else if (!isStaffRole(target.role ?? '')) {
        return NextResponse.json({ error: 'A client account must belong to an organisation.' }, { status: 400 });
      }
      set = { orgId: a.orgId };
      break;
    }
    case 'deactivate': set = { isActive: false }; break;
    case 'reactivate': set = { isActive: true, failedLoginAttempts: 0, lockoutUntil: null }; break;
    case 'unlock': set = { failedLoginAttempts: 0, lockoutUntil: null }; break;
  }

  await db.update(users).set({ ...set, updatedAt: new Date() }).where(eq(users.id, id));
  await recordAdminAction({ actorId: actor.id, orgId: (set.orgId ?? target.orgId) ?? null, targetType: 'ADMIN_USER', targetId: id, previous: before, next: { action: a.action, ...set }, reason: a.reason });
  return NextResponse.json({ ok: true });
}

/**
 * Remove an account. The row is kept and anonymised rather than deleted:
 * decisions, findings and declarations this person made must stay
 * attributable to an account for the life of those records. Their name,
 * email and credentials are erased, the account can never sign in again, and
 * the email address becomes free to register afresh.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await adminActor('manage_users');
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { confirmEmail?: string; reason?: string };

  const target = await load(id);
  if (!target) return NextResponse.json({ error: 'No such account.' }, { status: 404 });
  if (id === actor.id) return NextResponse.json({ error: 'You cannot remove your own account.' }, { status: 400 });
  if (target.isSuperAdmin && !actor.isSuperAdmin) return NextResponse.json({ error: 'Only a super admin can remove a super admin.' }, { status: 403 });
  if (target.isSuperAdmin && target.isActive !== false && (await activeSuperAdmins()) <= 1) {
    return NextResponse.json({ error: 'This is the last active super admin.' }, { status: 409 });
  }
  if ((body.confirmEmail ?? '').trim().toLowerCase() !== target.email.toLowerCase()) {
    return NextResponse.json({ error: 'Type the account\'s email address exactly to confirm.' }, { status: 400 });
  }
  if (!body.reason || body.reason.trim().length < 3) return NextResponse.json({ error: 'Give a reason.' }, { status: 400 });

  await getSystemDb().update(users).set({
    name: 'Removed account',
    email: `removed+${id}@removed.invalid`,
    passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12),
    isActive: false,
    isSuperAdmin: false,
    totpSecret: null,
    twoFactorSecret: null,
    twoFactorEnabled: false,
    mfaEnabled: false,
    backupCodes: [],
    jobTitle: null,
    updatedAt: new Date(),
  }).where(and(eq(users.id, id)));

  await recordAdminAction({ actorId: actor.id, orgId: target.orgId ?? null, targetType: 'ADMIN_USER', targetId: id, previous: { email: target.email, role: target.role }, next: { removed: true }, reason: body.reason.trim() });
  return NextResponse.json({ ok: true });
}
