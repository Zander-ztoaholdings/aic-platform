import { NextResponse } from 'next/server';
import { getSystemDb, users, and, inArray, sql } from '@aic/db';
import { adminActor } from '@/lib/admin';

/** Active AIC assessors, for assigning files. */
export async function GET() {
  const actor = await adminActor('view_all_orgs');
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const rows = await getSystemDb().select({ id: users.id, name: users.name, email: users.email, role: users.role })
    .from(users)
    .where(and(inArray(users.role, ['AIC_AUDITOR', 'AIC_SUPER_ADMIN']), sql`COALESCE(${users.isActive}, true) = true`, sql`${users.email} NOT LIKE '%@removed.invalid'`))
    .orderBy(users.name);
  return NextResponse.json({ assessors: rows, me: actor.id, isSuperAdmin: actor.isSuperAdmin });
}
