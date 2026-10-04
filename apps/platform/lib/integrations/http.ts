import { NextResponse } from 'next/server';
import { auth } from '@aic/auth';
import { canManageTeamAndKeys } from '@/lib/roles';
import { getTenantDb, hitlLogs } from '@aic/db';

/** The caller for an organisation-scoped integrations route, or a response to return. */
export async function orgCaller(opts: { manage?: boolean } = {}) {
  const session = await auth();
  const user = session?.user as { id?: string; orgId?: string; role?: string; name?: string | null; email?: string | null } | undefined;
  if (!user?.id || !user.orgId) {
    return { error: NextResponse.json({ error: 'Sign in with an organisation account.' }, { status: 401 }) } as const;
  }
  if (opts.manage && !canManageTeamAndKeys(user.role)) {
    return { error: NextResponse.json({ error: 'Only an organisation admin can change connected systems.' }, { status: 403 }) } as const;
  }
  return {
    orgId: user.orgId,
    userId: user.id,
    role: user.role ?? null,
    label: user.name || user.email || 'Organisation member',
    canManage: canManageTeamAndKeys(user.role),
  } as const;
}


/** Connecting or disconnecting a system is on the organisation's oversight log. */
export async function logIntegrationChange(input: {
  orgId: string; actorId: string; integrationId: string | null; previous: unknown; next: unknown; reason: string;
}) {
  try {
    await getTenantDb(input.orgId).query((tx) =>
      tx.insert(hitlLogs).values({
        orgId: input.orgId,
        actorId: input.actorId,
        targetType: 'INTEGRATION',
        targetId: input.integrationId,
        previousValue: input.previous as object,
        newValue: input.next as object,
        overrideReason: input.reason,
      })
    );
  } catch (e) {
    console.error('[INTEGRATIONS] oversight log write failed:', (e as Error).message);
  }
}
