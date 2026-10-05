import { NextResponse } from 'next/server';
import { auth } from '@aic/auth';
import { canManageCompliance } from '@/lib/roles';

/** The signed-in organisation member, and whether they may change which frameworks are tracked. */
export async function frameworksCaller(opts: { manage?: boolean } = {}) {
  const session = await auth();
  const u = session?.user as { id?: string; orgId?: string; role?: string } | undefined;
  if (!u?.id || !u.orgId) return { error: NextResponse.json({ error: 'Sign in with an organisation account.' }, { status: 401 }) } as const;
  const canManage = canManageCompliance(u.role);
  if (opts.manage && !canManage) return { error: NextResponse.json({ error: 'Your role cannot change the frameworks your organisation tracks.' }, { status: 403 }) } as const;
  return { orgId: u.orgId, userId: u.id, canManage } as const;
}

export const NOT_READY = () => NextResponse.json(
  { error: 'Choosing frameworks is not switched on for this AIC server yet (database migration 015). AIC has been told; until then you see the default frameworks.' },
  { status: 503 },
);

/** Postgres "relation does not exist": migration 015 has not been applied. */
export const isMissingTable = (e: unknown) => {
  const x = e as { code?: string; cause?: { code?: string } };
  return (x.code ?? x.cause?.code) === '42P01';
};
