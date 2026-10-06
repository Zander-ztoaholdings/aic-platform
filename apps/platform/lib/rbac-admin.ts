import { auth } from '@aic/auth';
import {
  getSystemDb,
  users,
  capabilities,
  userCapabilities,
  permissionAuditLogs,
  sql,
  eq,
  and,
} from '@aic/db';
import { CAPABILITIES, ALL_CAPABILITIES, ROLE_CAPABILITIES, roleHasCapability, type Capability } from './capabilities';

/**
 * The staff permissions screen, done honestly.
 *
 * Everything here describes or changes the model lib/rbac.ts actually runs:
 * per-person exceptions in `user_capabilities`, then the `isSuperAdmin`
 * boolean, then the static role matrix in lib/capabilities.ts. It does not
 * read or write `roles` / `role_capabilities`: nothing assigns `users.role_id`,
 * so those rows would change nobody's access, and a screen that edits them
 * would be a control that controls nothing.
 */

// ── Names and groupings ─────────────────────────────────────────────────────

/** A short, readable name per capability, for lists and the change log. */
export const CAPABILITY_NAME: Record<Capability, string> = {
  access_admin_tools: 'Use platform administration',
  access_hq: 'See HQ metrics',
  access_internal_tools: 'Use internal operations tools',
  approve_certification: 'Approve a certification decision',
  clear_impartiality_conflict: 'Clear an impartiality conflict',
  conduct_assessment: 'Carry out an assessment',
  issue_certification: 'Issue a certificate',
  manage_certification_lifecycle: 'Suspend, revoke or reinstate a certificate',
  manage_content: 'Publish website content',
  manage_roles: 'Change permissions',
  manage_users: 'Manage user accounts',
  upload_bias_report: 'Upload a bias report',
  view_all_orgs: 'See every organisation',
  view_revenue: 'See revenue figures',
};

export const CAPABILITY_CATEGORY: Record<Capability, string> = {
  access_admin_tools: 'Administration',
  access_hq: 'Administration',
  access_internal_tools: 'Administration',
  approve_certification: 'Certification decision',
  clear_impartiality_conflict: 'Certification decision',
  conduct_assessment: 'Assessment',
  issue_certification: 'Certification decision',
  manage_certification_lifecycle: 'Certification decision',
  manage_content: 'Website',
  manage_roles: 'Administration',
  manage_users: 'Administration',
  upload_bias_report: 'Client work',
  view_all_orgs: 'Assessment',
  view_revenue: 'Commercial',
};

/** Labels for `users.role` as the "because" text reads it. */
export const ROLE_TEXT: Record<string, string> = {
  AIC_AUDITOR: 'Auditor',
  // The label without the boolean holds only the auditor's set; see
  // lib/capabilities.ts. Saying so stops anyone reading it as "everything".
  AIC_SUPER_ADMIN: 'Super admin (label only)',
  ORG_ADMIN: 'Organisation admin',
  ORG_USER: 'Organisation user',
};

export const STAFF_ROLES = ['AIC_AUDITOR', 'AIC_SUPER_ADMIN'] as const;
export const CLIENT_ROLES = ['ORG_ADMIN', 'ORG_USER'] as const;

export const isCapability = (s: unknown): s is Capability =>
  typeof s === 'string' && Object.prototype.hasOwnProperty.call(CAPABILITIES, s);

// ── Pure: explain what someone can do and why ───────────────────────────────

export type Because =
  | 'per-person exception (granted)'
  | 'per-person exception (denied)'
  | 'super admin'
  | `role ${string}`
  | 'not held'
  | 'account deactivated';

export interface AccessLine {
  slug: Capability;
  description: string;
  granted: boolean;
  because: Because;
}

export interface ExplainUser {
  role: string | null;
  isSuperAdmin: boolean | null;
  /** rbac.ts refuses everything for a deactivated account before any other step. */
  isActive?: boolean | null;
}

export interface Override {
  slug: string;
  isGranted: boolean | null;
}

/**
 * For every capability, whether this person holds it and the step of
 * lib/rbac.ts that decides it, in the same order:
 *   deactivated account → per-person exception → isSuperAdmin → role matrix → not held.
 * The super-admin "view as" preview is ignored: it is a temporary lens on the
 * viewer's own session, not a property of the person. `role_id` grants are
 * ignored because nothing assigns a role_id.
 *
 * `now` is taken so callers state the moment the explanation is true for;
 * exceptions carry no expiry today, so it does not change the answer yet.
 */
export function explainAccess(user: ExplainUser, overrides: readonly Override[], _now: Date = new Date()): AccessLine[] {
  return ALL_CAPABILITIES.map((slug): AccessLine => {
    const base = { slug, description: CAPABILITIES[slug] };
    if (user.isActive === false) return { ...base, granted: false, because: 'account deactivated' };

    // rbac.ts reads the first matching row; we write at most one per pair.
    const o = overrides.find((x) => x.slug === slug);
    if (o) {
      return o.isGranted === false
        ? { ...base, granted: false, because: 'per-person exception (denied)' }
        : { ...base, granted: true, because: 'per-person exception (granted)' };
    }
    if (user.isSuperAdmin) return { ...base, granted: true, because: 'super admin' };
    if (roleHasCapability(user.role, slug)) {
      return { ...base, granted: true, because: `role ${ROLE_TEXT[user.role ?? ''] ?? user.role}` };
    }
    return { ...base, granted: false, because: 'not held' };
  });
}

// ── Pure: the role matrix shown to an assessor ──────────────────────────────

export const MATRIX_COLUMNS = [
  { key: 'AIC_AUDITOR', label: 'Auditor' },
  { key: 'SUPER_ADMIN', label: 'Super admin' },
  { key: 'ORG_ADMIN', label: 'Organisation admin' },
  { key: 'ORG_USER', label: 'Organisation user' },
] as const;

export function roleMatrix() {
  return {
    columns: MATRIX_COLUMNS,
    rows: ALL_CAPABILITIES.map((slug) => ({
      slug,
      name: CAPABILITY_NAME[slug],
      description: CAPABILITIES[slug],
      category: CAPABILITY_CATEGORY[slug],
      held: {
        AIC_AUDITOR: ROLE_CAPABILITIES.AIC_AUDITOR.includes(slug),
        // The boolean, not the role label: it reaches everything.
        SUPER_ADMIN: true,
        ORG_ADMIN: ROLE_CAPABILITIES.ORG_ADMIN.includes(slug),
        ORG_USER: ROLE_CAPABILITIES.ORG_USER.includes(slug),
      },
    })),
    roles: Object.fromEntries(Object.entries(ROLE_CAPABILITIES).map(([r, list]) => [r, [...list]])),
  };
}

export function capabilityList() {
  return ALL_CAPABILITIES.map((slug) => ({
    slug,
    name: CAPABILITY_NAME[slug],
    description: CAPABILITIES[slug],
    category: CAPABILITY_CATEGORY[slug],
  }));
}

// ── Pure: may this change be made? ──────────────────────────────────────────

export type Effect = 'grant' | 'deny';

export interface Party {
  id: string;
  role: string | null;
  isSuperAdmin: boolean | null;
}

export const MIN_REASON = 10;

/** null when the change may go ahead, otherwise the refusal in plain words. */
export function refuseChange(input: {
  actor: Party;
  target: Party;
  slug: string;
  effect: Effect | 'clear';
  reason: string;
}): string | null {
  const { actor, target, slug, effect, reason } = input;
  if (!actor.isSuperAdmin) return 'Only a super admin can change permissions.';
  if (!isCapability(slug)) return 'That is not a capability the platform knows.';
  if ((reason ?? '').trim().length < MIN_REASON) return `Write a reason of at least ${MIN_REASON} characters; it goes on the record.`;
  if (actor.id === target.id) return 'You cannot change your own exceptions. Ask another super admin.';
  const isStaff = !!target.isSuperAdmin || (STAFF_ROLES as readonly string[]).includes(target.role ?? '');
  if (effect !== 'clear' && !isStaff) {
    return 'Exceptions are for AIC staff only. What a client organisation’s people can do is set by their role.';
  }
  if (slug === 'manage_roles' && !target.isSuperAdmin && !actor.isSuperAdmin) {
    return 'Only a super admin can change who may change permissions.';
  }
  return null;
}

// ── Database ────────────────────────────────────────────────────────────────

type Result = { ok: true } | { ok: false; status: number; error: string };

/**
 * The caller, if and only if they are a signed-in, active super admin. The
 * session flag is checked first and then re-read from the database, so a
 * revoked super admin with a stale session gets nothing.
 */
export async function superAdminCaller(): Promise<{ id: string; name: string } | null> {
  const session = await auth();
  const s = session?.user as { id?: string; isSuperAdmin?: boolean } | undefined;
  if (!s?.id || s.isSuperAdmin !== true) return null;
  const [u] = await getSystemDb()
    .select({ id: users.id, name: users.name, isSuperAdmin: users.isSuperAdmin, isActive: users.isActive })
    .from(users)
    .where(eq(users.id, s.id))
    .limit(1);
  if (!u || u.isSuperAdmin !== true || u.isActive === false) return null;
  return { id: u.id, name: u.name };
}

/** One `capabilities` row per slug in code, so exceptions can point at them. */
export async function ensureCapabilityRows(): Promise<void> {
  const db = getSystemDb();
  for (const slug of ALL_CAPABILITIES) {
    await db
      .insert(capabilities)
      .values({ slug, name: CAPABILITY_NAME[slug], category: CAPABILITY_CATEGORY[slug] })
      .onConflictDoUpdate({
        target: capabilities.slug,
        set: { name: CAPABILITY_NAME[slug], category: CAPABILITY_CATEGORY[slug] },
      });
  }
}

export interface StaffPerson {
  id: string;
  name: string;
  email: string;
  role: string | null;
  isSuperAdmin: boolean;
  isActive: boolean;
  exceptions: { slug: string; name: string; effect: Effect }[];
  access: AccessLine[];
}

/** AIC staff (by role or by the boolean), each with what they can do and why. */
export async function listStaffWithOverrides(now: Date = new Date()): Promise<StaffPerson[]> {
  const db = getSystemDb();
  const people = await db.execute(sql`
    SELECT u.id, u.name, u.email, u.role,
           COALESCE(u.is_super_admin, false) AS "isSuperAdmin",
           COALESCE(u.is_active, true) AS "isActive"
    FROM users u
    WHERE (u.role IN ('AIC_AUDITOR', 'AIC_SUPER_ADMIN') OR COALESCE(u.is_super_admin, false))
      AND u.email NOT LIKE '%@removed.invalid'
    ORDER BY u.name
  `);
  const rows = people.rows as { id: string; name: string; email: string; role: string | null; isSuperAdmin: boolean; isActive: boolean }[];
  if (rows.length === 0) return [];

  const ov = await db.execute(sql`
    SELECT uc.user_id AS "userId", c.slug, uc.is_granted AS "isGranted"
    FROM user_capabilities uc JOIN capabilities c ON c.id = uc.capability_id
    WHERE uc.user_id IN (SELECT id FROM users WHERE role IN ('AIC_AUDITOR', 'AIC_SUPER_ADMIN') OR COALESCE(is_super_admin, false))
  `);
  const byUser = new Map<string, Override[]>();
  for (const r of ov.rows as { userId: string; slug: string; isGranted: boolean | null }[]) {
    const list = byUser.get(r.userId) ?? [];
    if (!list.some((x) => x.slug === r.slug)) list.push({ slug: r.slug, isGranted: r.isGranted });
    byUser.set(r.userId, list);
  }

  return rows.map((p) => {
    const overrides = byUser.get(p.id) ?? [];
    return {
      ...p,
      exceptions: overrides.map((o) => ({
        slug: o.slug,
        name: isCapability(o.slug) ? CAPABILITY_NAME[o.slug] : o.slug,
        effect: o.isGranted === false ? 'deny' : 'grant',
      })),
      access: explainAccess(p, overrides, now),
    };
  });
}

async function loadParty(id: string): Promise<Party | null> {
  const [u] = await getSystemDb()
    .select({ id: users.id, role: users.role, isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return u ?? null;
}

async function change(actorId: string, userId: string, slug: string, effect: Effect | 'clear', reason: string): Promise<Result> {
  const [actor, target] = await Promise.all([loadParty(actorId), loadParty(userId)]);
  if (!actor) return { ok: false, status: 403, error: 'Only a super admin can change permissions.' };
  if (!target) return { ok: false, status: 404, error: 'No such person.' };
  const refusal = refuseChange({ actor, target, slug, effect, reason });
  if (refusal) return { ok: false, status: refusal.startsWith('Only') ? 403 : 400, error: refusal };

  await ensureCapabilityRows();
  const db = getSystemDb();
  return db.transaction(async (tx) => {
    const [cap] = await tx.select({ id: capabilities.id }).from(capabilities).where(eq(capabilities.slug, slug)).limit(1);
    if (!cap) return { ok: false, status: 500, error: 'The capability list could not be prepared.' } as Result;
    const where = and(eq(userCapabilities.userId, userId), eq(userCapabilities.capabilityId, cap.id));
    const [prev] = await tx.select({ isGranted: userCapabilities.isGranted }).from(userCapabilities).where(where).limit(1);
    const previous: Effect | 'none' = !prev ? 'none' : prev.isGranted === false ? 'deny' : 'grant';
    if (effect === 'clear' && previous === 'none') {
      return { ok: false, status: 404, error: 'There is no exception to remove.' } as Result;
    }

    // No unique constraint on the pair, so replace rather than upsert.
    await tx.delete(userCapabilities).where(where);
    if (effect !== 'clear') {
      await tx.insert(userCapabilities).values({ userId, capabilityId: cap.id, isGranted: effect === 'grant' });
    }
    await tx.insert(permissionAuditLogs).values({
      actorId,
      targetUserId: userId,
      action: effect === 'grant' ? 'GRANT' : effect === 'deny' ? 'DENY' : 'CLEAR',
      details: { capability: slug, reason: reason.trim(), previous },
    });
    return { ok: true } as Result;
  });
}

export function setOverride(actorId: string, userId: string, slug: string, effect: Effect, reason: string) {
  return change(actorId, userId, slug, effect, reason);
}

export function clearOverride(actorId: string, userId: string, slug: string, reason: string) {
  return change(actorId, userId, slug, 'clear', reason);
}

export interface LogEntry {
  id: string;
  action: string;
  actorName: string | null;
  targetName: string | null;
  capability: string | null;
  capabilityName: string | null;
  reason: string | null;
  previous: string | null;
  createdAt: string;
}

/** The last 200 permission changes, newest first, with names resolved. */
export async function listPermissionLog(): Promise<LogEntry[]> {
  const r = await getSystemDb().execute(sql`
    SELECT l.id, l.action, a.name AS "actorName", t.name AS "targetName",
           l.details, l.created_at AS "createdAt"
    FROM permission_audit_logs l
    LEFT JOIN users a ON a.id = l.actor_id
    LEFT JOIN users t ON t.id = l.target_user_id
    ORDER BY l.created_at DESC
    LIMIT 200
  `);
  return (r.rows as { id: string; action: string; actorName: string | null; targetName: string | null; details: Record<string, unknown> | null; createdAt: string }[]).map((row) => {
    const d = row.details ?? {};
    const capability = typeof d.capability === 'string' ? d.capability : null;
    return {
      id: row.id,
      action: row.action,
      actorName: row.actorName,
      targetName: row.targetName,
      capability,
      capabilityName: capability && isCapability(capability) ? CAPABILITY_NAME[capability] : capability,
      reason: typeof d.reason === 'string' ? d.reason : null,
      previous: typeof d.previous === 'string' ? d.previous : null,
      createdAt: new Date(row.createdAt).toISOString(),
    };
  });
}
