import { auth } from '@aic/auth';
import { getSystemDb, users, hitlLogs, eq } from '@aic/db';
import { hasCapability } from './rbac';
import type { Capability } from './capabilities';

export interface AdminActor { id: string; isSuperAdmin: boolean }

/**
 * The signed-in person, if they may perform this admin capability. A super
 * admin previewing another role fails here: hasCapability answers as the
 * previewed role.
 */
export async function adminActor(capability: Capability): Promise<AdminActor | null> {
  const session = await auth();
  const id = session?.user?.id as string | undefined;
  if (!id || !(await hasCapability(id, capability))) return null;
  const [u] = await getSystemDb().select({ s: users.isSuperAdmin }).from(users).where(eq(users.id, id)).limit(1);
  return { id, isSuperAdmin: !!u?.s && !session?.user?.viewAs };
}

/** Every admin change goes on the oversight record: who, what, before, after, why. */
export async function recordAdminAction(input: {
  actorId: string;
  orgId: string | null;
  targetType: 'ADMIN_USER' | 'ADMIN_ORG' | 'ADMIN_EVIDENCE';
  targetId: string | null;
  previous: unknown;
  next: unknown;
  reason: string;
}) {
  await getSystemDb().insert(hitlLogs).values({
    orgId: input.orgId,
    actorId: input.actorId,
    targetType: input.targetType,
    targetId: input.targetId,
    previousValue: input.previous as object,
    newValue: input.next as object,
    overrideReason: input.reason,
  });
}

export const ROLES = ['AIC_SUPER_ADMIN', 'AIC_AUDITOR', 'ORG_ADMIN', 'ORG_USER'] as const;
export type Role = (typeof ROLES)[number];
export const isStaffRole = (r: string) => r === 'AIC_SUPER_ADMIN' || r === 'AIC_AUDITOR';
