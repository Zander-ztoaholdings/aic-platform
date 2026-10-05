/**
 * What the registers say, as evidence for the common controls.
 *
 * Each register answers one control: suppliers for supplier risk, the risk
 * register for risk assessment, training for awareness, access reviews for
 * access review, and the people list (against connected accounts) for
 * removing leavers' access. A register nobody has started is "no evidence",
 * not a failure; a register with something overdue or unsafe is a gap.
 *
 * Tolerates migration 016 not being applied: everything reads as no evidence.
 */
import {
  getTenantDb, suppliers, supplierReviews, risks, orgTraining, trainingCompletions, accessReviews, accessReviewItems, orgPeople, users,
  and, eq, desc,
} from '@aic/db';
import { supplierState, supplierFlags } from './suppliers';
import { DEFAULT_REQUIRED, isCurrent, MODULE_BY_KEY } from '../training/modules';
import { listAccounts, leaversWithAccess } from './accounts';

export type FactStatus = 'pass' | 'fail' | 'pending' | 'none';
export type Fact = { status: FactStatus; label: string; href: string };
export type FactKey = 'suppliers' | 'risks' | 'training' | 'access_review' | 'leavers';

const SIX_MONTHS = 183 * 86_400_000;
const leaverCache = new Map<string, { at: number; fact: Fact }>();

export async function registerFacts(orgId: string): Promise<Partial<Record<FactKey, Fact>>> {
  const db = getTenantDb(orgId);
  let data;
  try {
    data = await db.query(async (tx) => ({
      sup: await tx.select().from(suppliers).where(and(eq(suppliers.orgId, orgId), eq(suppliers.status, 'active'))),
      revs: await tx.select({ supplierId: supplierReviews.supplierId, outcome: supplierReviews.outcome, at: supplierReviews.reviewedAt }).from(supplierReviews).where(eq(supplierReviews.orgId, orgId)).orderBy(desc(supplierReviews.reviewedAt)),
      rks: await tx.select().from(risks).where(eq(risks.orgId, orgId)),
      req: await tx.select().from(orgTraining).where(eq(orgTraining.orgId, orgId)),
      done: await tx.select({ userId: trainingCompletions.userId, moduleKey: trainingCompletions.moduleKey, at: trainingCompletions.completedAt }).from(trainingCompletions).where(eq(trainingCompletions.orgId, orgId)),
      members: await tx.select({ id: users.id, active: users.isActive, email: users.email }).from(users).where(eq(users.orgId, orgId)),
      reviews: await tx.select().from(accessReviews).where(eq(accessReviews.orgId, orgId)).orderBy(desc(accessReviews.createdAt)),
      items: await tx.select({ reviewId: accessReviewItems.reviewId, decision: accessReviewItems.decision, removedAt: accessReviewItems.removedAt }).from(accessReviewItems).where(eq(accessReviewItems.orgId, orgId)),
      people: await tx.select({ name: orgPeople.name, email: orgPeople.email, endDate: orgPeople.endDate }).from(orgPeople).where(eq(orgPeople.orgId, orgId)),
    }));
  } catch {
    return {};
  }
  const now = Date.now();
  const out: Partial<Record<FactKey, Fact>> = {};

  // Suppliers
  if (data.sup.length) {
    const last = new Map<string, { outcome: string }>();
    for (const r of data.revs) if (!last.has(r.supplierId)) last.set(r.supplierId, r);
    const states = data.sup.map((s) => ({ s, st: supplierState({ nextReviewAt: s.nextReviewAt, lastOutcome: last.get(s.id)?.outcome ?? null }, now), flags: supplierFlags(s) }));
    const badHigh = states.filter((x) => x.s.criticality === 'high' && (x.st === 'not_reviewed' || x.st === 'due')).length;
    const flagged = states.filter((x) => x.flags.length > 0).length;
    const waiting = states.filter((x) => x.st === 'not_reviewed' || x.st === 'due').length;
    out.suppliers = badHigh || flagged
      ? { status: 'fail', label: `Supplier register: ${badHigh ? `${badHigh} critical supplier${badHigh === 1 ? '' : 's'} not reviewed on time` : ''}${badHigh && flagged ? ', ' : ''}${flagged ? `${flagged} with a data protection gap` : ''}`, href: '/suppliers' }
      : waiting
        ? { status: 'pending', label: `Supplier register: ${waiting} review${waiting === 1 ? '' : 's'} due`, href: '/suppliers' }
        : { status: 'pass', label: `Supplier register: ${data.sup.length} suppliers reviewed`, href: '/suppliers' };
  }

  // Risks
  const live = data.rks.filter((r) => r.status !== 'closed');
  if (data.rks.length) {
    const unowned = live.filter((r) => !r.ownerName).length;
    const overdue = live.filter((r) => r.reviewAt && new Date(r.reviewAt).getTime() < now).length;
    out.risks = unowned || overdue
      ? { status: 'fail', label: `Risk register: ${[unowned ? `${unowned} without an owner` : '', overdue ? `${overdue} overdue for review` : ''].filter(Boolean).join(', ')}`, href: '/risks' }
      : { status: 'pass', label: `Risk register: ${live.length} open risk${live.length === 1 ? '' : 's'}, each owned and reviewed on time`, href: '/risks' };
  }

  // Training
  const people = data.members.filter((m) => m.active !== false && !m.email.endsWith('@removed.invalid'));
  const required = data.req.length ? data.req.filter((r) => r.required && MODULE_BY_KEY[r.moduleKey]) : DEFAULT_REQUIRED.map((k) => ({ moduleKey: k, everyMonths: 12 }));
  if (people.length && required.length && data.done.length) {
    let due = 0, current = 0;
    for (const p of people) for (const r of required) {
      const ok = data.done.some((c) => c.userId === p.id && c.moduleKey === r.moduleKey && isCurrent(c.at, r.everyMonths, now));
      if (ok) current++; else due++;
    }
    const total = current + due;
    out.training = due === 0
      ? { status: 'pass', label: `Training: everyone is up to date (${total} of ${total})`, href: '/training' }
      : { status: 'pending', label: `Training: ${current} of ${total} module completions up to date`, href: '/training' };
  }

  // Access reviews
  if (data.reviews.length) {
    const lastDone = data.reviews.find((r) => r.status === 'completed');
    const open = data.reviews.find((r) => r.status === 'open');
    const pendingRemovals = lastDone ? data.items.filter((i) => i.reviewId === lastDone.id && (i.decision === 'remove' || i.decision === 'reduce') && !i.removedAt).length : 0;
    if (lastDone && lastDone.completedAt && now - new Date(lastDone.completedAt).getTime() < SIX_MONTHS) {
      out.access_review = pendingRemovals
        ? { status: 'fail', label: `Access review: ${pendingRemovals} removal${pendingRemovals === 1 ? '' : 's'} decided but not yet done`, href: '/access-reviews' }
        : { status: 'pass', label: `Access review completed ${new Date(lastDone.completedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, href: '/access-reviews' };
    } else if (open) {
      out.access_review = { status: 'pending', label: 'Access review in progress', href: '/access-reviews' };
    } else {
      out.access_review = { status: 'fail', label: 'Access review: none completed in the last six months', href: '/access-reviews' };
    }
  }

  // Leavers: only when someone has left, and cached, because it reads the connected systems.
  const today = new Date().toISOString().slice(0, 10);
  const left = data.people.filter((p) => p.endDate && p.endDate < today);
  if (left.length) {
    const cached = leaverCache.get(orgId);
    if (cached && now - cached.at < 10 * 60_000) out.leavers = cached.fact;
    else {
      try {
        const { accounts } = await listAccounts(orgId);
        const still = leaversWithAccess(data.people.map((p) => ({ ...p, endDate: p.endDate as string | null })), accounts, today);
        const fact: Fact = still.length
          ? { status: 'fail', label: `${still.length} of ${left.length} leavers still have access: ${still.slice(0, 3).map((s) => s.name).join(', ')}`, href: '/people' }
          : { status: 'pass', label: `All ${left.length} leavers have no remaining access in connected systems`, href: '/people' };
        leaverCache.set(orgId, { at: now, fact });
        out.leavers = fact;
      } catch { /* systems unreachable: no evidence either way */ }
    }
  }
  return out;
}

/** Drop the cached leaver result, after the people list or a connection changes. */
export const forgetLeavers = (orgId: string) => leaverCache.delete(orgId);
