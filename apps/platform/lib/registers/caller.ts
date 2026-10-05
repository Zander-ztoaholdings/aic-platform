import { NextResponse } from 'next/server';
import { auth } from '@aic/auth';
import { canManageCompliance, canManageTeamAndKeys } from '@/lib/roles';

/**
 * The signed-in organisation member for the registers (suppliers, risks,
 * training, access reviews, people). Members do the day-to-day work; some
 * settings are for admins only.
 */
export async function orgCaller(opts: { manage?: boolean; admin?: boolean } = {}) {
  const session = await auth();
  const u = session?.user as { id?: string; orgId?: string; role?: string; name?: string } | undefined;
  if (!u?.id || !u.orgId) return { error: NextResponse.json({ error: 'Sign in with an organisation account.' }, { status: 401 }) } as const;
  const canManage = canManageCompliance(u.role);
  const isAdmin = canManageTeamAndKeys(u.role);
  if (opts.manage && !canManage) return { error: NextResponse.json({ error: 'Your role cannot change this.' }, { status: 403 }) } as const;
  if (opts.admin && !isAdmin) return { error: NextResponse.json({ error: 'Only an organisation admin can change this.' }, { status: 403 }) } as const;
  return { orgId: u.orgId, userId: u.id, name: u.name ?? null, canManage, isAdmin } as const;
}

/** Postgres "relation does not exist": the migration has not been applied. */
export const isMissingTable = (e: unknown) => {
  const x = e as { code?: string; cause?: { code?: string } };
  return (x.code ?? x.cause?.code) === '42P01';
};

export const notReady = (migration: string) => NextResponse.json(
  { error: `This is not switched on for this AIC server yet (database migration ${migration}). AIC has been told.`, notReady: true },
  { status: 503 },
);

/** Runs a handler and turns "table missing" into a clear 503. */
export async function guarded<T>(migration: string, fn: () => Promise<T>): Promise<T | NextResponse> {
  try { return await fn(); } catch (e) { if (isMissingTable(e)) return notReady(migration); throw e; }
}
