/**
 * Bulk actions on organisations and accounts, for AIC staff.
 *
 * Built to clear test data quickly without making it easy to destroy a real
 * client by mistake. Every bulk action:
 *   1. is previewed first: what will happen to each item, and which items
 *      will be skipped and why;
 *   2. needs a reason, which goes on the oversight record with every name;
 *   3. for anything that cannot be undone (deleting an organisation,
 *      removing an account), also needs the exact phrase "delete 3
 *      organisations" typed and the person's own password entered again;
 *   4. never touches what AIC must keep or cannot do without: organisations
 *      with a certificate or an AIC Aware badge, the demo company (it has its
 *      own reset), your own account, or the last active super admin.
 */
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { getSystemDb, users, organizations, hitlLogs, and, eq, desc, inArray, sql } from '@aic/db';
import { recordAdminAction } from './admin';

export const BULK_MAX = 50;
export const DEMO_ORG_ID = 'de300000-0000-4000-8000-0000000000a1';

export type OrgAction = 'suspend' | 'restore' | 'delete';
export type UserAction = 'deactivate' | 'reactivate' | 'remove';
export const DESTRUCTIVE: ReadonlySet<string> = new Set(['delete', 'remove']);

export const ORG_ACTION_LABEL: Record<OrgAction, string> = { suspend: 'Suspend access', restore: 'Restore access', delete: 'Delete with everything in it' };
export const USER_ACTION_LABEL: Record<UserAction, string> = { deactivate: 'Deactivate', reactivate: 'Reactivate', remove: 'Remove (cannot be undone)' };

/** Pure: the phrase a person types to confirm something that cannot be undone. */
export function confirmPhrase(kind: 'organizations' | 'users', action: string, n: number): string | null {
  if (!DESTRUCTIVE.has(action)) return null;
  const noun = kind === 'organizations' ? (n === 1 ? 'organisation' : 'organisations') : (n === 1 ? 'account' : 'accounts');
  return `${action} ${n} ${noun}`;
}

export type OrgFacts = { id: string; name: string; members: number; activeMembers: number; systems: number; decisions: number; documents: number; certs: number; badges: number };
export type PlanItem = { id: string; label: string; detail: string; skip: string | null };

/** Pure: what a bulk organisation action will do to each one. */
export function planOrgs(action: OrgAction, orgs: OrgFacts[]): PlanItem[] {
  return orgs.map((o) => {
    const detail = action === 'delete'
      ? `${o.members} member${o.members === 1 ? '' : 's'} removed, ${o.systems} AI system${o.systems === 1 ? '' : 's'}, ${o.decisions.toLocaleString('en-GB')} decision${o.decisions === 1 ? '' : 's'} and ${o.documents} document${o.documents === 1 ? '' : 's'} deleted`
      : action === 'suspend' ? `${o.activeMembers} active member${o.activeMembers === 1 ? '' : 's'} signed out and blocked`
        : 'Members blocked by the last suspension can sign in again';
    let skip: string | null = null;
    if (o.id === DEMO_ORG_ID) skip = 'The demo company: rebuild or remove it from Admin, Demo company.';
    else if (action === 'delete' && (o.certs > 0 || o.badges > 0)) skip = 'Holds a certificate or an AIC Aware badge, which AIC must keep. Suspend it instead.';
    else if (action === 'suspend' && o.activeMembers === 0) skip = 'Nobody to suspend: no active members.';
    return { id: o.id, label: o.name, detail, skip };
  });
}

export type UserFacts = { id: string; email: string; name: string; role: string | null; isSuperAdmin: boolean; isActive: boolean; removed: boolean };

/** Pure: what a bulk account action will do to each one. */
export function planUsers(action: UserAction, list: UserFacts[], actor: { id: string; isSuperAdmin: boolean }, activeSuperAdmins: number): PlanItem[] {
  // Super admins that would be switched off by this batch, to protect the last one.
  let supersLeft = activeSuperAdmins;
  return list.map((u) => {
    let skip: string | null = null;
    if (u.id === actor.id) skip = 'Your own account.';
    else if (u.removed) skip = 'Already removed.';
    else if (u.isSuperAdmin && !actor.isSuperAdmin) skip = 'Only a super admin can change a super admin.';
    else if (action === 'reactivate' && u.isActive) skip = 'Already active.';
    else if (action === 'deactivate' && !u.isActive) skip = 'Already deactivated.';
    else if (action !== 'reactivate' && u.isSuperAdmin && u.isActive) {
      if (supersLeft <= 1) skip = 'The last active super admin.';
      else supersLeft -= 1;
    }
    const detail = action === 'remove' ? 'Name, email and sign-in erased; what they recorded stays attributed to a removed account'
      : action === 'deactivate' ? 'Cannot sign in until reactivated' : 'Can sign in again';
    return { id: u.id, label: `${u.name} (${u.email})`, detail, skip };
  });
}

// ── Re-entering the password ────────────────────────────────────────────────

const misses = new Map<string, { n: number; until: number }>();

/** Checks the person's own password. Five misses lock bulk actions for them for ten minutes. */
export async function checkOwnPassword(userId: string, password: unknown): Promise<string | null> {
  const m = misses.get(userId);
  if (m && m.until > Date.now()) return 'Too many wrong passwords. Try again in ten minutes.';
  if (typeof password !== 'string' || !password) return 'Enter your password to confirm.';
  const [u] = await getSystemDb().select({ hash: users.passwordHash }).from(users).where(eq(users.id, userId)).limit(1);
  const ok = !!u && (await bcrypt.compare(password, u.hash));
  if (ok) { misses.delete(userId); return null; }
  const n = (m && m.until > Date.now() ? m.n : 0) + 1;
  misses.set(userId, { n, until: n >= 5 ? Date.now() + 10 * 60_000 : 0 });
  return 'That password is not right.';
}

// ── Reading what is there ───────────────────────────────────────────────────

export async function orgFacts(ids: string[]): Promise<OrgFacts[]> {
  if (!ids.length) return [];
  const r = await getSystemDb().execute(sql`
    SELECT o.id, o.name,
      (SELECT count(*)::int FROM users u WHERE u.org_id = o.id AND u.email NOT LIKE '%@removed.invalid') AS members,
      (SELECT count(*)::int FROM users u WHERE u.org_id = o.id AND COALESCE(u.is_active, true) AND u.email NOT LIKE '%@removed.invalid') AS "activeMembers",
      (SELECT count(*)::int FROM ai_systems s WHERE s.org_id = o.id) AS systems,
      (SELECT count(*)::int FROM decision_records d WHERE d.org_id = o.id) AS decisions,
      (SELECT count(*)::int FROM audit_documents a WHERE a.org_id = o.id) AS documents,
      (SELECT count(*)::int FROM issued_certifications c WHERE c.org_id = o.id) AS certs,
      (SELECT count(*)::int FROM aware_badges b WHERE b.org_id = o.id) AS badges
    FROM organizations o WHERE o.id IN (${sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)})
    ORDER BY o.name`);
  return (r.rows as OrgFacts[]).map((o) => ({ ...o, members: Number(o.members), activeMembers: Number(o.activeMembers), systems: Number(o.systems), decisions: Number(o.decisions), documents: Number(o.documents), certs: Number(o.certs), badges: Number(o.badges) }));
}

export async function userFacts(ids: string[]): Promise<UserFacts[]> {
  if (!ids.length) return [];
  const rows = await getSystemDb().select({ id: users.id, email: users.email, name: users.name, role: users.role, isSuperAdmin: users.isSuperAdmin, isActive: users.isActive })
    .from(users).where(inArray(users.id, ids)).orderBy(users.name);
  return rows.map((u) => ({ ...u, isSuperAdmin: !!u.isSuperAdmin, isActive: u.isActive !== false, removed: u.email.endsWith('@removed.invalid') }));
}

export async function activeSuperAdmins(): Promise<number> {
  const r = await getSystemDb().execute(sql`SELECT count(*)::int AS n FROM users WHERE is_super_admin = true AND COALESCE(is_active, true) = true`);
  return Number((r.rows[0] as { n: number }).n);
}

// ── Doing it ────────────────────────────────────────────────────────────────

const anonymised = async (id: string) => ({
  name: 'Removed account', email: `removed+${id}@removed.invalid`,
  passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12),
  isActive: false, isSuperAdmin: false, totpSecret: null, twoFactorSecret: null, twoFactorEnabled: false, mfaEnabled: false,
  backupCodes: [] as string[], jobTitle: null, updatedAt: new Date(),
});

/**
 * Deletes one organisation and everything filed under it. Its members are
 * removed (anonymised, as a single removal does) and detached; anything else
 * that refers to it without ON DELETE CASCADE has its rows for this
 * organisation cleared, read from Postgres so a table added later cannot
 * block it. All in one transaction: it goes completely or not at all.
 */
export async function purgeOrg(id: string): Promise<void> {
  const db = getSystemDb();
  const members = await db.select({ id: users.id }).from(users).where(eq(users.orgId, id));
  const blanks = await Promise.all(members.map(async (m) => ({ id: m.id, set: await anonymised(m.id) })));
  await db.transaction(async (tx) => {
    for (const b of blanks) await tx.update(users).set({ ...b.set, orgId: null }).where(eq(users.id, b.id));
    const refs = await tx.execute(sql`
      SELECT c.conrelid::regclass::text AS tbl, a.attname AS col, a.attnotnull AS required
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
      WHERE c.contype = 'f' AND c.confrelid = 'organizations'::regclass
        AND array_length(c.conkey, 1) = 1 AND c.confdeltype NOT IN ('c', 'n')`);
    for (const r of refs.rows as { tbl: string; col: string; required: boolean }[]) {
      if (!/^[a-z_][a-z0-9_."]*$/i.test(r.tbl) || !/^[a-z_][a-z0-9_]*$/i.test(r.col)) continue;
      const t = sql.raw(r.tbl); const col = sql.raw(`"${r.col}"`);
      if (r.required) await tx.execute(sql`DELETE FROM ${t} WHERE ${col} = ${id}::uuid`);
      else await tx.execute(sql`UPDATE ${t} SET ${col} = NULL WHERE ${col} = ${id}::uuid`);
    }
    await tx.delete(organizations).where(eq(organizations.id, id));
  });
}

export async function suspendOrg(id: string, actorId: string, reason: string): Promise<number> {
  const db = getSystemDb();
  const off = await db.update(users).set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(users.orgId, id), sql`COALESCE(${users.isActive}, true) = true`)).returning({ id: users.id });
  // The same record a single suspension writes, so either kind of restore finds it.
  await recordAdminAction({ actorId, orgId: id, targetType: 'ADMIN_ORG', targetId: id, previous: null, next: { suspended: true, userIds: off.map((u) => u.id), bulk: true }, reason });
  return off.length;
}

export async function restoreOrg(id: string, actorId: string, reason: string): Promise<number> {
  const db = getSystemDb();
  const [last] = await db.select({ next: hitlLogs.newValue }).from(hitlLogs)
    .where(and(eq(hitlLogs.targetType, 'ADMIN_ORG'), eq(hitlLogs.targetId, id), sql`${hitlLogs.newValue}->>'suspended' = 'true'`))
    .orderBy(desc(hitlLogs.createdAt)).limit(1);
  const ids = (last?.next as { userIds?: string[] } | null)?.userIds ?? [];
  let n = 0;
  for (const uid of ids) {
    const r = await db.update(users).set({ isActive: true, updatedAt: new Date() })
      .where(and(eq(users.id, uid), eq(users.orgId, id), sql`${users.email} NOT LIKE '%@removed.invalid'`)).returning({ id: users.id });
    n += r.length;
  }
  await recordAdminAction({ actorId, orgId: id, targetType: 'ADMIN_ORG', targetId: id, previous: null, next: { restored: true, count: n, bulk: true }, reason });
  return n;
}

export async function applyToUser(action: UserAction, u: UserFacts & { orgId?: string | null }, actorId: string, reason: string): Promise<void> {
  const db = getSystemDb();
  const set = action === 'remove' ? await anonymised(u.id)
    : action === 'deactivate' ? { isActive: false, updatedAt: new Date() }
      : { isActive: true, failedLoginAttempts: 0, lockoutUntil: null, updatedAt: new Date() };
  await db.update(users).set(set).where(eq(users.id, u.id));
  await recordAdminAction({ actorId, orgId: null, targetType: 'ADMIN_USER', targetId: u.id, previous: { email: u.email, role: u.role, isActive: u.isActive }, next: { action, bulk: true }, reason });
}
