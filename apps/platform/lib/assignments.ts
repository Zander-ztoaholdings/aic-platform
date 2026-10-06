import { getSystemDb, orgAssignments, organizations, users, hitlLogs, sql, eq, and, isNull } from '@aic/db';

/**
 * Who looks after which organisation.
 *
 * Every organisation has a lead (the AIC auditor who holds the file and does
 * the assessment) and, where AIC has a second auditor free of conflicts, a
 * reviewer, so no file is seen by one person only. Rows live in
 * org_assignments (db/manual/018); a row is current while ended_at is null.
 * organizations.auditor_id, which the evidence screens check, is kept equal
 * to the current lead.
 *
 * Separation of duties: leads and reviewers assess; neither decides
 * certification. The default rule picks only AIC auditors, never super
 * admins, because super admins make the certification decision. A super admin
 * can still be assigned by hand, as before.
 *
 * Impartiality: anyone with a declared conflict for an organisation
 * (conflict_checks BLOCKED, or a recent advisory relationship not cleared) is
 * never assigned to it, by the default rule or by hand.
 *
 * The top half is pure and unit tested; the bottom half reads and writes the
 * database and tolerates the tables being missing before migration 018.
 * It deliberately imports nothing that pulls in the session (next-auth), so
 * the pure half can be tested on its own.
 */

export const ROLES = ['lead', 'reviewer'] as const;
export type AssignmentRole = (typeof ROLES)[number];
export const isAssignmentRole = (v: unknown): v is AssignmentRole => v === 'lead' || v === 'reviewer';
export const ROLE_NAME: Record<AssignmentRole, string> = { lead: 'Lead', reviewer: 'Reviewer' };

export type StaffMember = {
  id: string;
  name: string;
  email?: string | null;
  role: string | null;
  isActive: boolean | null;
  isSuperAdmin: boolean | null;
};

/** Current work per person: organisations led, organisations reviewed, evidence waiting in the ones they lead. */
export type Load = { leads: number; reviews: number; waiting: number };
export const NO_LOAD: Load = { leads: 0, reviews: 0, waiting: 0 };

/** Ten documents waiting for review weigh as much as one more organisation to lead. */
export const WAITING_PER_ORG = 10;
export const MIN_REASON = 3;

const removed = (m: StaffMember) => !!m.email && m.email.endsWith('@removed.invalid');
const active = (m: StaffMember) => m.isActive !== false && !removed(m);

/** May the default rule pick this person? Active AIC auditors only; super admins decide certification. */
export function canBeDefault(m: StaffMember): boolean {
  return active(m) && m.role === 'AIC_AUDITOR' && m.isSuperAdmin !== true;
}

/** May this person be assigned by hand? Any active AIC staff member. */
export function canHold(m: StaffMember): boolean {
  return active(m) && (m.role === 'AIC_AUDITOR' || m.role === 'AIC_SUPER_ADMIN' || m.isSuperAdmin === true);
}

/** A conflict_checks row that stands: refused at claim, or a recent advisory relationship never cleared. */
export function isConflict(row: { status?: string | null; isCleared?: boolean | null; hasPriorAdvisoryRelationship?: boolean | null }): boolean {
  return row.status === 'BLOCKED' || (row.isCleared === false && row.hasPriorAdvisoryRelationship === true);
}

export function loadScore(l: Load): number {
  return l.leads + l.waiting / WAITING_PER_ORG;
}

type LoadMap = Map<string, Load> | Record<string, Load | undefined>;
const loadOf = (load: LoadMap, id: string): Load =>
  (load instanceof Map ? load.get(id) : load[id]) ?? NO_LOAD;
const asSet = (s: Iterable<string> | undefined) => new Set(s ?? []);

/** Deterministic order: by the given keys, then name, then id. */
function rank<T extends StaffMember>(people: T[], keys: (m: T) => number[]): T[] {
  return [...people].sort((a, b) => {
    const ka = keys(a), kb = keys(b);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i];
    const byName = a.name.localeCompare(b.name, 'en-GB');
    return byName !== 0 ? byName : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/**
 * The default lead: among active auditors with no conflict for this
 * organisation, the one with the lowest load score (organisations led plus
 * waiting evidence / 10), then fewest organisations led, then fewest reviews,
 * then name, then id.
 */
export function pickLead(staff: StaffMember[], opts: { conflicted?: Iterable<string>; load?: LoadMap; exclude?: Iterable<string> } = {}): string | null {
  const conflicted = asSet(opts.conflicted), exclude = asSet(opts.exclude), load = opts.load ?? {};
  const pool = staff.filter((m) => canBeDefault(m) && !conflicted.has(m.id) && !exclude.has(m.id));
  const [best] = rank(pool, (m) => { const l = loadOf(load, m.id); return [loadScore(l), l.leads, l.reviews]; });
  return best?.id ?? null;
}

/**
 * The default reviewer: a different eligible auditor from the lead (four
 * eyes), with the fewest reviews, then the lowest load score, then name, then
 * id. Null when nobody else is eligible.
 */
export function pickReviewer(staff: StaffMember[], opts: { leadId: string | null; conflicted?: Iterable<string>; load?: LoadMap; exclude?: Iterable<string> }): string | null {
  const conflicted = asSet(opts.conflicted), exclude = asSet(opts.exclude), load = opts.load ?? {};
  const pool = staff.filter((m) => canBeDefault(m) && m.id !== opts.leadId && !conflicted.has(m.id) && !exclude.has(m.id));
  const [best] = rank(pool, (m) => { const l = loadOf(load, m.id); return [l.reviews, loadScore(l)]; });
  return best?.id ?? null;
}

/**
 * Lead for a new client: the person who brought them in, when they may hold
 * the file and have no conflict; otherwise the default rule.
 */
export function chooseSignupLead(staff: StaffMember[], preferredId: string | null, opts: { conflicted?: Iterable<string>; load?: LoadMap } = {}): { id: string; source: 'preferred' | 'default' } | null {
  const conflicted = asSet(opts.conflicted);
  if (preferredId) {
    const p = staff.find((m) => m.id === preferredId);
    if (p && canHold(p) && !conflicted.has(p.id)) return { id: p.id, source: 'preferred' };
  }
  const id = pickLead(staff, opts);
  return id ? { id, source: 'default' } : null;
}

/** Why this person cannot take this seat, or null if they can. */
export function assignmentProblem(input: {
  person: StaffMember | null | undefined;
  role: AssignmentRole;
  conflicted: Iterable<string>;
  current: { leadId: string | null; reviewerId: string | null };
}): string | null {
  const { person, role, current } = input;
  if (!person || !canHold(person)) return 'That person is not an active member of AIC staff.';
  if (asSet(input.conflicted).has(person.id)) return 'That person has declared a conflict of interest with this organisation, so they cannot be assigned to it.';
  if ((role === 'lead' ? current.leadId : current.reviewerId) === person.id) return `They are already the ${role} for this organisation.`;
  if (role === 'lead' && current.reviewerId === person.id) return 'They are this organisation’s reviewer. The lead and reviewer must be different people; change the reviewer first.';
  if (role === 'reviewer' && current.leadId === person.id) return 'They are this organisation’s lead. The lead and reviewer must be different people.';
  return null;
}

export type OrgSeat = { id: string; leadId: string | null; reviewerId: string | null; waiting: number; conflicted?: Iterable<string> };
export type PlannedAssignment = { orgId: string; role: AssignmentRole; userId: string };

/**
 * The default rule over many organisations at once, oldest first as given.
 * Fills every empty lead seat, then the reviewer seat where a second eligible
 * auditor exists, updating the load as it goes so work spreads out rather
 * than piling onto whoever was least busy at the start.
 */
export function planAutoAssign(orgs: OrgSeat[], staff: StaffMember[], initial: LoadMap): PlannedAssignment[] {
  const load = new Map<string, Load>();
  for (const m of staff) load.set(m.id, { ...loadOf(initial, m.id) });
  const bump = (id: string, f: (l: Load) => void) => { const l = load.get(id) ?? { ...NO_LOAD }; f(l); load.set(id, l); };
  const plan: PlannedAssignment[] = [];
  for (const o of orgs) {
    let lead = o.leadId;
    if (!lead) {
      lead = pickLead(staff, { conflicted: o.conflicted, load, exclude: o.reviewerId ? [o.reviewerId] : [] });
      if (lead) { plan.push({ orgId: o.id, role: 'lead', userId: lead }); bump(lead, (l) => { l.leads += 1; l.waiting += o.waiting; }); }
    }
    if (!o.reviewerId && lead) {
      const reviewer = pickReviewer(staff, { leadId: lead, conflicted: o.conflicted, load });
      if (reviewer) { plan.push({ orgId: o.id, role: 'reviewer', userId: reviewer }); bump(reviewer, (l) => { l.reviews += 1; }); }
    }
  }
  return plan;
}

/** Load per person from the current assignments and each organisation's waiting evidence. */
export function computeLoad(current: { orgId: string; userId: string; role: string }[], waitingByOrg: Map<string, number> | Record<string, number>): Map<string, Load> {
  const waiting = (id: string) => (waitingByOrg instanceof Map ? waitingByOrg.get(id) : waitingByOrg[id]) ?? 0;
  const out = new Map<string, Load>();
  for (const a of current) {
    const l = out.get(a.userId) ?? { ...NO_LOAD };
    if (a.role === 'lead') { l.leads += 1; l.waiting += waiting(a.orgId); } else if (a.role === 'reviewer') l.reviews += 1;
    out.set(a.userId, l);
  }
  return out;
}

export type Scope = 'mine' | 'all';
/**
 * Which view a staff work queue opens on. An auditor with at least one
 * assignment starts on their own organisations; super admins, and auditors
 * with nothing assigned yet, start on everything.
 */
export function defaultScope(u: { role?: string | null; isSuperAdmin?: boolean | null; assignedCount: number }): Scope {
  if (u.isSuperAdmin) return 'all';
  return u.role === 'AIC_AUDITOR' && u.assignedCount > 0 ? 'mine' : 'all';
}
export const parseScope = (v: string | null | undefined): Scope | null => (v === 'mine' || v === 'all' ? v : null);

// ── Database ────────────────────────────────────────────────────────────────

export type CurrentAssignment = {
  id: string; orgId: string; orgName: string; userId: string; userName: string; role: AssignmentRole;
  assignedAt: string; assignedBy: string | null; assignedByName: string | null; reason: string;
};
export type AssignmentResult = { ok: true } | { ok: false; error: string; status: number };

const db = () => getSystemDb();
const rows = <T>(r: { rows: unknown[] }) => r.rows as T[];
const num = (v: unknown) => Number(v ?? 0) || 0;

/** Every current assignment, with names. Throws if migration 018 has not run (callers guard). */
export async function currentAssignments(): Promise<CurrentAssignment[]> {
  return rows<CurrentAssignment>(await db().execute(sql`
    SELECT a.id, a.org_id AS "orgId", o.name AS "orgName", a.user_id AS "userId", u.name AS "userName", a.role,
           a.assigned_at AS "assignedAt", a.assigned_by AS "assignedBy", b.name AS "assignedByName", a.reason
    FROM org_assignments a
    JOIN organizations o ON o.id = a.org_id
    JOIN users u ON u.id = a.user_id
    LEFT JOIN users b ON b.id = a.assigned_by
    WHERE a.ended_at IS NULL
    ORDER BY o.name, a.role`));
}

/** AIC staff accounts, removed ones left out. */
export async function staffMembers(): Promise<(StaffMember & { email: string })[]> {
  return rows<StaffMember & { email: string }>(await db().execute(sql`
    SELECT id, name, email, role::text AS role, is_active AS "isActive", is_super_admin AS "isSuperAdmin"
    FROM users
    WHERE (role IN ('AIC_AUDITOR', 'AIC_SUPER_ADMIN') OR is_super_admin = true)
      AND email NOT LIKE '%@removed.invalid'
    ORDER BY name`));
}

/** Staff with a standing conflict, per organisation (optionally one). */
export async function conflictsByOrg(orgId?: string): Promise<Map<string, Set<string>>> {
  const r = rows<{ orgId: string; userId: string }>(await db().execute(sql`
    SELECT DISTINCT org_id AS "orgId", auditor_id AS "userId" FROM conflict_checks
    WHERE org_id IS NOT NULL AND auditor_id IS NOT NULL
      AND (status = 'BLOCKED' OR (is_cleared = false AND has_prior_advisory_relationship = true))
      ${orgId ? sql`AND org_id = ${orgId}` : sql``}`));
  const out = new Map<string, Set<string>>();
  for (const x of r) { const s = out.get(x.orgId) ?? new Set<string>(); s.add(x.userId); out.set(x.orgId, s); }
  return out;
}

/** Evidence waiting for review, per organisation. */
export async function waitingByOrg(): Promise<Map<string, number>> {
  const r = rows<{ orgId: string; n: number }>(await db().execute(sql`
    SELECT org_id AS "orgId", count(*)::int AS n FROM audit_documents
    WHERE verification_outcome IS NULL AND superseded_by IS NULL AND org_id IS NOT NULL
    GROUP BY org_id`));
  return new Map(r.map((x) => [x.orgId, num(x.n)]));
}

/** Organisation ids this person leads or reviews now; null when assignments are not switched on yet. */
export async function myOrgIds(userId: string): Promise<string[] | null> {
  try {
    const r = rows<{ orgId: string }>(await db().execute(sql`
      SELECT DISTINCT org_id AS "orgId" FROM org_assignments WHERE user_id = ${userId} AND ended_at IS NULL`));
    return r.map((x) => x.orgId);
  } catch (e) {
    if (isMissingTable(e)) return null;
    throw e;
  }
}

/** Scope for a work queue: what was asked for, else the person's default. */
export async function resolveScope(user: { id: string; role?: string | null; isSuperAdmin?: boolean | null }, requested: string | null): Promise<{ scope: Scope; orgIds: string[] | null }> {
  const orgIds = await myOrgIds(user.id).catch(() => null);
  const asked = parseScope(requested);
  if (orgIds === null) return { scope: 'all', orgIds: null };
  return { scope: asked ?? defaultScope({ role: user.role, isSuperAdmin: user.isSuperAdmin, assignedCount: orgIds.length }), orgIds };
}

async function seats(orgId: string): Promise<{ leadId: string | null; reviewerId: string | null }> {
  const r = await db().select({ userId: orgAssignments.userId, role: orgAssignments.role }).from(orgAssignments)
    .where(and(eq(orgAssignments.orgId, orgId), isNull(orgAssignments.endedAt)));
  return { leadId: r.find((x) => x.role === 'lead')?.userId ?? null, reviewerId: r.find((x) => x.role === 'reviewer')?.userId ?? null };
}

const pgCode = (e: unknown) => { const x = e as { code?: string; cause?: { code?: string } }; return x.code ?? x.cause?.code; };
/** Postgres "relation does not exist": migration 018 has not run. */
export const isMissingTable = (e: unknown) => pgCode(e) === '42P01';

const uniqueViolation = (e: unknown) => {
  const x = e as { code?: string; cause?: { code?: string } };
  return (x.code ?? x.cause?.code) === '23505';
};

async function log(actor: string | null, orgId: string, previous: unknown, next: unknown, reason: string) {
  try {
    // The oversight record, as lib/admin.ts recordAdminAction writes it (not imported: it pulls in the session).
    await db().insert(hitlLogs).values({ orgId, actorId: actor, targetType: 'ADMIN_ORG', targetId: orgId, previousValue: previous as object, newValue: next as object, overrideReason: reason });
  } catch (e) {
    console.error('[ASSIGNMENTS] could not write the oversight record:', e instanceof Error ? e.message : e);
  }
}

/**
 * Put a person in a seat, ending whoever held it. Refuses anyone who is not
 * active AIC staff, has a declared conflict, or already holds the other seat.
 * `actor` null means the system (sign-up, default rule without a person).
 */
export async function assign(orgId: string, userId: string, role: AssignmentRole, actor: string | null, reason: string): Promise<AssignmentResult> {
  const why = reason.trim();
  if (why.length < MIN_REASON) return { ok: false, error: 'Give a short reason; it goes on the record.', status: 400 };
  const d = db();
  const [org] = await d.select({ id: organizations.id, auditorId: organizations.auditorId }).from(organizations).where(eq(organizations.id, orgId)).limit(1);
  if (!org) return { ok: false, error: 'No such organisation.', status: 404 };
  const [person] = await d.select({ id: users.id, name: users.name, email: users.email, role: users.role, isActive: users.isActive, isSuperAdmin: users.isSuperAdmin })
    .from(users).where(eq(users.id, userId)).limit(1);
  const current = await seats(orgId);
  const conflicted = (await conflictsByOrg(orgId)).get(orgId) ?? new Set<string>();
  const problem = assignmentProblem({ person: person ? { ...person, role: person.role ?? null } : null, role, conflicted, current });
  if (problem) return { ok: false, error: problem, status: 409 };

  const previous = role === 'lead' ? current.leadId : current.reviewerId;
  try {
    await d.transaction(async (tx) => {
      await tx.update(orgAssignments).set({ endedAt: new Date(), endedBy: actor, endReason: why })
        .where(and(eq(orgAssignments.orgId, orgId), eq(orgAssignments.role, role), isNull(orgAssignments.endedAt)));
      await tx.insert(orgAssignments).values({ orgId, userId, role, assignedBy: actor, reason: why });
      if (role === 'lead') await tx.update(organizations).set({ auditorId: userId }).where(eq(organizations.id, orgId));
    });
  } catch (e) {
    if (uniqueViolation(e)) return { ok: false, error: 'Someone changed this organisation’s assignments a moment ago. Reload and try again.', status: 409 };
    throw e;
  }
  await log(actor, orgId, { assignment: { role, userId: previous } }, { assignment: { role, userId } }, why);
  return { ok: true };
}

/** End the current holder of a seat. Ending the lead also clears the file holder. */
export async function unassign(orgId: string, role: AssignmentRole, actor: string | null, reason: string): Promise<AssignmentResult> {
  const why = reason.trim();
  if (why.length < MIN_REASON) return { ok: false, error: 'Give a short reason; it goes on the record.', status: 400 };
  const d = db();
  const ended = await d.transaction(async (tx) => {
    const r = await tx.update(orgAssignments).set({ endedAt: new Date(), endedBy: actor, endReason: why })
      .where(and(eq(orgAssignments.orgId, orgId), eq(orgAssignments.role, role), isNull(orgAssignments.endedAt)))
      .returning({ userId: orgAssignments.userId });
    if (role === 'lead' && r[0]) await tx.update(organizations).set({ auditorId: null }).where(and(eq(organizations.id, orgId), eq(organizations.auditorId, r[0].userId)));
    return r[0]?.userId ?? null;
  });
  if (!ended) return { ok: false, error: `Nobody is the ${role} for this organisation.`, status: 404 };
  await log(actor, orgId, { assignment: { role, userId: ended } }, { assignment: { role, userId: null } }, why);
  return { ok: true };
}

/**
 * Keep the assignment record in step with organizations.auditor_id when that
 * is changed elsewhere (the register's "Take file" and super admin assign).
 * Best effort: before migration 018, or on any failure, it logs and returns.
 */
export async function recordFileHolder(orgId: string, userId: string | null, actor: string | null, reason: string): Promise<void> {
  try {
    const d = db();
    const current = await seats(orgId);
    if (current.leadId === userId) return;
    const why = reason.trim() || 'File holder changed';
    await d.transaction(async (tx) => {
      await tx.update(orgAssignments).set({ endedAt: new Date(), endedBy: actor, endReason: why })
        .where(and(eq(orgAssignments.orgId, orgId), eq(orgAssignments.role, 'lead'), isNull(orgAssignments.endedAt)));
      if (userId) {
        // The new lead cannot also be the reviewer.
        await tx.update(orgAssignments).set({ endedAt: new Date(), endedBy: actor, endReason: 'Became the lead for this organisation' })
          .where(and(eq(orgAssignments.orgId, orgId), eq(orgAssignments.userId, userId), isNull(orgAssignments.endedAt)));
        await tx.insert(orgAssignments).values({ orgId, userId, role: 'lead', assignedBy: actor, reason: why });
      }
    });
  } catch (e) {
    if (!isMissingTable(e)) console.error('[ASSIGNMENTS] could not record the file holder:', e instanceof Error ? e.message : e);
  }
}

type State = {
  staff: (StaffMember & { email: string })[];
  current: CurrentAssignment[];
  conflicts: Map<string, Set<string>>;
  waiting: Map<string, number>;
  load: Map<string, Load>;
};
async function readState(orgId?: string): Promise<State> {
  const [staff, current, conflicts, waiting] = await Promise.all([staffMembers(), currentAssignments(), conflictsByOrg(orgId), waitingByOrg()]);
  return { staff, current, conflicts, waiting, load: computeLoad(current, waiting) };
}

async function apply(plan: PlannedAssignment[], actor: string | null, reason: string): Promise<{ done: PlannedAssignment[]; failed: (PlannedAssignment & { error: string })[] }> {
  const done: PlannedAssignment[] = [], failed: (PlannedAssignment & { error: string })[] = [];
  for (const p of plan) {
    const r = await assign(p.orgId, p.userId, p.role, actor, reason);
    if (r.ok) done.push(p); else failed.push({ ...p, error: r.error });
  }
  return { done, failed };
}

const DEFAULT_REASON = 'Assigned by the default rule: fewest organisations and least waiting evidence, no declared conflict.';

/** Fill this organisation's empty seats by the default rule. */
export async function autoAssign(orgId: string, actor: string | null = null, reason = DEFAULT_REASON) {
  const s = await readState(orgId);
  const mine = s.current.filter((a) => a.orgId === orgId);
  const plan = planAutoAssign([{
    id: orgId,
    leadId: mine.find((a) => a.role === 'lead')?.userId ?? null,
    reviewerId: mine.find((a) => a.role === 'reviewer')?.userId ?? null,
    waiting: s.waiting.get(orgId) ?? 0,
    conflicted: s.conflicts.get(orgId),
  }], s.staff, s.load);
  return apply(plan, actor, reason);
}

/** Fill every empty seat across the register by the default rule, oldest organisation first. */
export async function autoAssignAllUnassigned(actor: string | null, reason = DEFAULT_REASON) {
  const s = await readState();
  const orgs = rows<{ id: string }>(await db().execute(sql`SELECT id FROM organizations ORDER BY created_at ASC NULLS LAST, id`));
  const seatsByOrg = new Map<string, { leadId: string | null; reviewerId: string | null }>();
  for (const a of s.current) {
    const x = seatsByOrg.get(a.orgId) ?? { leadId: null, reviewerId: null };
    if (a.role === 'lead') x.leadId = a.userId; else x.reviewerId = a.userId;
    seatsByOrg.set(a.orgId, x);
  }
  const plan = planAutoAssign(
    orgs.map((o) => ({ id: o.id, ...(seatsByOrg.get(o.id) ?? { leadId: null, reviewerId: null }), waiting: s.waiting.get(o.id) ?? 0, conflicted: s.conflicts.get(o.id) })),
    s.staff, s.load,
  );
  return apply(plan, actor, reason);
}

/**
 * Give a newly signed-up organisation its lead (and reviewer, where one is
 * free). The preferred lead, usually whoever sent the onboarding link, is
 * used when they are active AIC staff with no conflict; otherwise the
 * default rule. Never throws: on any failure it logs and returns null, so
 * sign-up is never held up by this.
 */
export async function assignOnSignup(orgId: string, preferredLeadId: string | null): Promise<{ leadId: string; reviewerId: string | null; source: 'preferred' | 'default' } | null> {
  try {
    const s = await readState(orgId);
    const conflicted = s.conflicts.get(orgId);
    const existing = s.current.filter((a) => a.orgId === orgId);
    let leadId = existing.find((a) => a.role === 'lead')?.userId ?? null;
    let source: 'preferred' | 'default' = 'default';
    if (!leadId) {
      const choice = chooseSignupLead(s.staff, preferredLeadId, { conflicted, load: s.load });
      if (!choice) { console.warn(`[ASSIGNMENTS] no eligible auditor for new organisation ${orgId}; left unassigned`); return null; }
      const r = await assign(orgId, choice.id, 'lead', null, choice.source === 'preferred' ? 'Signed up through this person’s onboarding link.' : DEFAULT_REASON);
      if (!r.ok) { console.warn(`[ASSIGNMENTS] could not assign a lead to ${orgId}: ${r.error}`); return null; }
      leadId = choice.id; source = choice.source;
    }
    let reviewerId = existing.find((a) => a.role === 'reviewer')?.userId ?? null;
    if (!reviewerId) {
      const pick = pickReviewer(s.staff, { leadId, conflicted, load: s.load });
      if (pick && (await assign(orgId, pick, 'reviewer', null, DEFAULT_REASON)).ok) reviewerId = pick;
    }
    return { leadId, reviewerId, source };
  } catch (e) {
    console.error('[ASSIGNMENTS] sign-up assignment failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

export type HistoryRow = {
  id: string; orgId: string; orgName: string; userName: string; role: AssignmentRole;
  assignedAt: string; assignedByName: string | null; reason: string;
  endedAt: string | null; endedByName: string | null; endReason: string | null;
};

/** Assignment history, newest change first (optionally for one organisation). */
export async function assignmentHistory(orgId?: string, limit = 100): Promise<HistoryRow[]> {
  return rows<HistoryRow>(await db().execute(sql`
    SELECT a.id, a.org_id AS "orgId", o.name AS "orgName", u.name AS "userName", a.role,
           a.assigned_at AS "assignedAt", b.name AS "assignedByName", a.reason,
           a.ended_at AS "endedAt", e.name AS "endedByName", a.end_reason AS "endReason"
    FROM org_assignments a
    JOIN organizations o ON o.id = a.org_id
    JOIN users u ON u.id = a.user_id
    LEFT JOIN users b ON b.id = a.assigned_by
    LEFT JOIN users e ON e.id = a.ended_by
    ${orgId ? sql`WHERE a.org_id = ${orgId}` : sql``}
    ORDER BY greatest(a.assigned_at, coalesce(a.ended_at, a.assigned_at)) DESC
    LIMIT ${limit}`));
}

/** Lead and reviewer per organisation, for lists. Empty when assignments are not switched on. */
export async function seatsByOrg(): Promise<Map<string, { lead: { id: string; name: string } | null; reviewer: { id: string; name: string } | null }>> {
  const out = new Map<string, { lead: { id: string; name: string } | null; reviewer: { id: string; name: string } | null }>();
  let cur: CurrentAssignment[] = [];
  try { cur = await currentAssignments(); } catch (e) { if (!isMissingTable(e)) console.error('[ASSIGNMENTS] seats unavailable:', e instanceof Error ? e.message : e); return out; }
  for (const a of cur) {
    const x = out.get(a.orgId) ?? { lead: null, reviewer: null };
    x[a.role] = { id: a.userId, name: a.userName };
    out.set(a.orgId, x);
  }
  return out;
}
