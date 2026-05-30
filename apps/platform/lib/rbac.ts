import { getSystemDb, users, capabilities, roleCapabilities, userCapabilities, and, eq } from '@aic/db';

/**
 * RBAC Utility: Checks if a user has a specific granular capability.
 * Follows the logic:
 * 1. Check user-specific overrides (userCapabilities) first.
 * 2. If no override, check the capabilities assigned to the user's role.
 */
export async function hasCapability(userId: string, capabilitySlug: string): Promise<boolean> {
  const db = getSystemDb();

  // 1. Fetch capability ID
  const [cap] = await db
    .select({ id: capabilities.id })
    .from(capabilities)
    .where(eq(capabilities.slug, capabilitySlug))
    .limit(1);

  if (!cap) return false;

  // 2. Check for explicit User Override (WordPress style 'user_can')
  const [userOverride] = await db
    .select({ isGranted: userCapabilities.isGranted })
    .from(userCapabilities)
    .where(and(eq(userCapabilities.userId, userId), eq(userCapabilities.capabilityId, cap.id)))
    .limit(1);

  if (userOverride !== undefined) {
    return !!userOverride.isGranted;
  }

  // 3. Fallback to Role-based Capability
  const [user] = await db
    .select({ roleId: users.roleId, isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return false;
  if (user.isSuperAdmin) return true; // God Mode
  if (!user.roleId) return false;

  const [roleCap] = await db
    .select()
    .from(roleCapabilities)
    .where(and(eq(roleCapabilities.roleId, user.roleId), eq(roleCapabilities.capabilityId, cap.id)))
    .limit(1);

  return !!roleCap;
}
