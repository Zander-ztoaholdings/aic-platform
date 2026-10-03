import { NextRequest, NextResponse } from 'next/server';
import { getSystemDb, sql, users, eq } from '@aic/db';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { adminActor, recordAdminAction, ROLES, isStaffRole } from '@/lib/admin';

const CreateUserSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().email(),
  password: z.string().min(12),
  role: z.enum(ROLES),
  orgId: z.string().uuid().optional().nullable(),
});

/** Every account, with what an administrator needs to manage it. */
export async function GET() {
  const actor = await adminActor('manage_users');
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const rows = await getSystemDb().execute(sql`
    SELECT u.id, u.name, u.email, u.role, u.org_id AS "orgId", o.name AS "orgName",
           COALESCE(u.is_active, true) AS "isActive", COALESCE(u.is_super_admin, false) AS "isSuperAdmin",
           COALESCE(u.email_verified, false) AS "emailVerified",
           (COALESCE(u.mfa_enabled, false) OR COALESCE(u.two_factor_enabled, false)) AS "mfaEnabled",
           u.lockout_until AS "lockoutUntil", u.last_login AS "lastLogin", u.created_at AS "createdAt"
    FROM users u LEFT JOIN organizations o ON o.id = u.org_id
    WHERE u.email NOT LIKE '%@removed.invalid'
    ORDER BY u.created_at DESC
  `);
  return NextResponse.json({ users: rows.rows, me: actor.id, canGrantSuperAdmin: actor.isSuperAdmin });
}

/** Create an account directly (staff accounts, mostly; clients normally register or are invited). */
export async function POST(req: NextRequest) {
  const actor = await adminActor('manage_users');
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const parsed = CreateUserSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Check the form.' }, { status: 400 });
  const { name, email, password, role, orgId } = parsed.data;

  if (role === 'AIC_SUPER_ADMIN' && !actor.isSuperAdmin) {
    return NextResponse.json({ error: 'Only a super admin can create another super admin.' }, { status: 403 });
  }
  if (!isStaffRole(role) && !orgId) {
    return NextResponse.json({ error: 'A client account needs an organisation.' }, { status: 400 });
  }

  const db = getSystemDb();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  if (existing) return NextResponse.json({ error: 'That email already has an account.' }, { status: 409 });

  const [created] = await db.insert(users).values({
    name,
    email: email.toLowerCase(),
    passwordHash: await bcrypt.hash(password, 12),
    role,
    orgId: isStaffRole(role) ? null : orgId,
    isActive: true,
    isSuperAdmin: role === 'AIC_SUPER_ADMIN',
  }).returning({ id: users.id });

  await recordAdminAction({ actorId: actor.id, orgId: isStaffRole(role) ? null : orgId ?? null, targetType: 'ADMIN_USER', targetId: created.id, previous: null, next: { created: true, role, email: email.toLowerCase() }, reason: 'Account created by an administrator' });
  return NextResponse.json({ id: created.id }, { status: 201 });
}
