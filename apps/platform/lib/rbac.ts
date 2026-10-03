import { getSystemDb, users, capabilities, roleCapabilities, userCapabilities, and, eq } from '@aic/db';
import { roleHasCapability, type Capability } from './capabilities';
import { readViewAsCookie } from '@aic/auth';

export type { Capability } from './capabilities';

/**
 * The AIC-staff authorisation gate.
 *
 * RESOLUTION ORDER, highest precedence first:
 *
 *   1. An explicit per-user row in `user_capabilities`. Grant or deny, it wins
 *      — a deny recorded against a named person has to be able to override
 *      whatever their role would otherwise give them, or it is not a control.
 *   2. `users.isSuperAdmin`. The boolean, not the label. See lib/roles.ts.
 *   3. The static matrix in lib/capabilities.ts, keyed on `users.role`.
 *   4. `role_capabilities` via `users.role_id`, for admin-managed roles.
 *
 * Anything that falls off the end is denied and logged.
 *
 * WHAT CHANGED AND WHY.
 *
 * Steps 1 and 4 were the entire function. Both read tables that have never been
 * seeded, through a `users.role_id` column that nothing in this codebase ever
 * writes, so in practice every check resolved to step 2 or to false. Auditors
 * could do nothing; only a super-admin could do anything. Step 3 is the new
 * foundation and needs no seed to work.
 *
 * The supplementary database lookups are individually guarded. If the
 * capability tables are absent or unreachable, this degrades to the static
 * matrix and says so in the log — it does not throw a 500 out of an
 * authorisation check, and it does not fail open: every path that is not an
 * affirmative grant returns false.
 */
export async function hasCapability(userId: string, capability: Capability): Promise<boolean> {
  if (!userId) return false;

  const db = getSystemDb();

  const [user] = await db
    .select({
      role: users.role,
      roleId: users.roleId,
      isSuperAdmin: users.isSuperAdmin,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    deny(userId, capability, 'no such user');
    return false;
  }

  // A deactivated account keeps its role and its rows; it does not keep its
  // authority. Checking this here means every capability-gated route inherits
  // the deactivation without having to remember it.
  if (user.isActive === false) {
    deny(userId, capability, 'account deactivated');
    return false;
  }

  // 0. Super-admin preview: answer as the previewed role would, from the
  //    static matrix only. Never widens anything — a super admin already
  //    holds every capability.
  if (user.isSuperAdmin) {
    const preview = await readViewAsCookie();
    if (preview) {
      const granted = roleHasCapability(preview.role, capability);
      if (!granted) deny(userId, capability, `previewing as ${preview.role}`);
      return granted;
    }
  }

  // 1. Explicit per-user override.
  const override = await userOverride(db, userId, capability);
  if (override !== null) {
    if (!override) deny(userId, capability, 'explicit per-user deny');
    return override;
  }

  // 2. The boolean that actually carries AIC-staff power.
  if (user.isSuperAdmin) return true;

  // 3. The reviewed, version-controlled matrix.
  if (roleHasCapability(user.role, capability)) return true;

  // 4. Admin-managed role grants, when such a role has been assigned.
  if (user.roleId && (await roleGrant(db, user.roleId, capability))) return true;

  deny(userId, capability, `role ${user.role ?? 'none'} does not hold it`);
  return false;
}

/**
 * true / false from an explicit row, or null when there is no row to read.
 * Null is the only value that lets resolution continue, so a lookup failure
 * can never turn into an accidental grant.
 */
async function userOverride(
  db: ReturnType<typeof getSystemDb>,
  userId: string,
  capability: Capability
): Promise<boolean | null> {
  try {
    const [cap] = await db
      .select({ id: capabilities.id })
      .from(capabilities)
      .where(eq(capabilities.slug, capability))
      .limit(1);
    if (!cap) return null;

    const [row] = await db
      .select({ isGranted: userCapabilities.isGranted })
      .from(userCapabilities)
      .where(and(eq(userCapabilities.userId, userId), eq(userCapabilities.capabilityId, cap.id)))
      .limit(1);

    if (!row) return null;
    return !!row.isGranted;
  } catch (error) {
    console.warn(
      `[AUTHZ] capability tables unreadable while checking '${capability}'; falling back to the static matrix.`,
      error
    );
    return null;
  }
}

async function roleGrant(
  db: ReturnType<typeof getSystemDb>,
  roleId: string,
  capability: Capability
): Promise<boolean> {
  try {
    const [cap] = await db
      .select({ id: capabilities.id })
      .from(capabilities)
      .where(eq(capabilities.slug, capability))
      .limit(1);
    if (!cap) return false;

    const [row] = await db
      .select({ roleId: roleCapabilities.roleId })
      .from(roleCapabilities)
      .where(and(eq(roleCapabilities.roleId, roleId), eq(roleCapabilities.capabilityId, cap.id)))
      .limit(1);

    return !!row;
  } catch {
    return false;
  }
}

/**
 * Every refusal is logged. An accreditation assessor asking "show me that your
 * access controls work" wants evidence of denials, not an assurance that the
 * code contains an if-statement. Denials only — logging every success would
 * bury them.
 */
function deny(userId: string, capability: Capability, reason: string) {
  console.warn(`[AUTHZ] denied user=${userId} capability=${capability} reason="${reason}"`);
}
