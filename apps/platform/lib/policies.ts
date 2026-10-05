import { NextResponse } from 'next/server';
import { auth } from '@aic/auth';
import { getTenantDb, users, eq, and } from '@aic/db';
import { canManageTeamAndKeys } from '@/lib/roles';

export { bodyHash } from './policy-hash';

export async function policyCaller(opts: { manage?: boolean } = {}) {
  const session = await auth();
  const u = session?.user as { id?: string; orgId?: string; role?: string } | undefined;
  if (!u?.id || !u.orgId) return { error: NextResponse.json({ error: 'Sign in with an organisation account.' }, { status: 401 }) } as const;
  const canManage = canManageTeamAndKeys(u.role);
  if (opts.manage && !canManage) return { error: NextResponse.json({ error: 'Only an organisation admin can change policies.' }, { status: 403 }) } as const;
  return { orgId: u.orgId, userId: u.id, canManage } as const;
}

/** People in the organisation who are expected to accept policies. */
export async function orgMembers(orgId: string) {
  return getTenantDb(orgId).query((tx) =>
    tx.select({ id: users.id, name: users.name, email: users.email, role: users.role })
      .from(users)
      .where(and(eq(users.orgId, orgId), eq(users.isActive, true)))
  ).then((rows) => rows.filter((r) => !r.email.endsWith('@removed.invalid')));
}
