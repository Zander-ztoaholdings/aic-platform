import { describe, it, expect } from 'vitest';
import {
  canBeDefault, canHold, isConflict, loadScore, pickLead, pickReviewer, chooseSignupLead,
  assignmentProblem, planAutoAssign, computeLoad, defaultScope, parseScope, type StaffMember, type Load,
} from '@/lib/assignments';

const person = (id: string, name: string, over: Partial<StaffMember> = {}): StaffMember =>
  ({ id, name, email: `${id}@aic.test`, role: 'AIC_AUDITOR', isActive: true, isSuperAdmin: false, ...over });

const amara = person('a', 'Amara');
const ben = person('b', 'Ben');
const chloe = person('c', 'Chloe');
const boss = person('s', 'Sam', { role: 'AIC_SUPER_ADMIN', isSuperAdmin: true });
const gone = person('g', 'Gail', { isActive: false });
const client = person('o', 'Olu', { role: 'ORG_ADMIN' });
const removed = person('r', 'Rae', { email: 'x@removed.invalid' });
const L = (leads: number, reviews = 0, waiting = 0): Load => ({ leads, reviews, waiting });

describe('eligibility', () => {
  it('the default rule takes only active auditors, never super admins', () => {
    expect([amara, boss, gone, client, removed].map(canBeDefault)).toEqual([true, false, false, false, false]);
    expect(canBeDefault(person('x', 'X', { isSuperAdmin: true }))).toBe(false);
  });
  it('by hand, any active AIC staff member may hold a seat', () => {
    expect([amara, boss, gone, client, removed].map(canHold)).toEqual([true, true, false, false, false]);
  });
  it('a refused claim or an uncleared recent advisory relationship is a conflict', () => {
    expect(isConflict({ status: 'BLOCKED' })).toBe(true);
    expect(isConflict({ status: 'PENDING', isCleared: false, hasPriorAdvisoryRelationship: true })).toBe(true);
    expect(isConflict({ status: 'CLEARED', isCleared: true, hasPriorAdvisoryRelationship: true })).toBe(false);
    expect(isConflict({ status: 'PENDING', isCleared: false, hasPriorAdvisoryRelationship: false })).toBe(false);
  });
});

describe('pickLead', () => {
  it('picks the person with the fewest organisations', () => {
    expect(pickLead([amara, ben, chloe], { load: { a: L(3), b: L(1), c: L(2) } })).toBe('b');
  });
  it('weighs waiting evidence: ten documents count as one organisation', () => {
    expect(loadScore(L(1, 0, 10))).toBe(2);
    expect(pickLead([amara, ben], { load: { a: L(1, 0, 25), b: L(2, 0, 0) } })).toBe('b');
    expect(pickLead([amara, ben], { load: { a: L(1, 0, 5), b: L(2, 0, 0) } })).toBe('a');
  });
  it('never picks someone with a declared conflict, even if they are free', () => {
    expect(pickLead([amara, ben], { conflicted: ['a'], load: { a: L(0), b: L(9) } })).toBe('b');
    expect(pickLead([amara], { conflicted: new Set(['a']) })).toBeNull();
  });
  it('never picks super admins, inactive or removed people, or client users', () => {
    expect(pickLead([boss, gone, client, removed])).toBeNull();
    expect(pickLead([boss, gone, ben], { load: { b: L(20) } })).toBe('b');
  });
  it('breaks ties by fewest organisations, then fewest reviews, then name, then id', () => {
    expect(pickLead([amara, ben], { load: { a: L(1, 2), b: L(1, 1) } })).toBe('b');
    expect(pickLead([ben, amara])).toBe('a');
    const twin = person('0', 'Amara');
    expect(pickLead([amara, twin])).toBe('0');
  });
  it('is stable whatever order the staff arrive in', () => {
    const load = { a: L(1), b: L(1), c: L(0, 3) };
    expect(pickLead([amara, ben, chloe], { load })).toBe(pickLead([chloe, ben, amara], { load }));
  });
});

describe('pickReviewer', () => {
  it('is always someone other than the lead', () => {
    expect(pickReviewer([amara, ben], { leadId: 'a' })).toBe('b');
    expect(pickReviewer([amara], { leadId: 'a' })).toBeNull();
  });
  it('prefers the fewest reviews, and respects conflicts', () => {
    expect(pickReviewer([amara, ben, chloe], { leadId: 'a', load: { b: L(0, 4), c: L(5, 1) } })).toBe('c');
    expect(pickReviewer([amara, ben, chloe], { leadId: 'a', conflicted: ['c'], load: { b: L(0, 4), c: L(5, 1) } })).toBe('b');
  });
});

describe('chooseSignupLead', () => {
  it('uses the preferred person when they may hold the file', () => {
    expect(chooseSignupLead([amara, ben], 'b', { load: { b: L(9) } })).toEqual({ id: 'b', source: 'preferred' });
    expect(chooseSignupLead([amara, boss], 's')).toEqual({ id: 's', source: 'preferred' });
  });
  it('falls back to the default rule when the preferred person is conflicted, inactive or unknown', () => {
    expect(chooseSignupLead([amara, ben], 'b', { conflicted: ['b'] })).toEqual({ id: 'a', source: 'default' });
    expect(chooseSignupLead([amara, gone], 'g')).toEqual({ id: 'a', source: 'default' });
    expect(chooseSignupLead([amara], 'nobody')).toEqual({ id: 'a', source: 'default' });
    expect(chooseSignupLead([amara], null)).toEqual({ id: 'a', source: 'default' });
  });
  it('returns null when nobody is eligible', () => {
    expect(chooseSignupLead([boss], null)).toBeNull();
  });
});

describe('assignmentProblem', () => {
  const empty = { leadId: null, reviewerId: null };
  it('allows an eligible person into an empty seat', () => {
    expect(assignmentProblem({ person: amara, role: 'lead', conflicted: [], current: empty })).toBeNull();
    expect(assignmentProblem({ person: boss, role: 'reviewer', conflicted: [], current: empty })).toBeNull();
  });
  it('refuses a conflict, a non-staff or inactive person, and the same person in both seats', () => {
    expect(assignmentProblem({ person: amara, role: 'lead', conflicted: ['a'], current: empty })).toMatch(/conflict/);
    expect(assignmentProblem({ person: client, role: 'lead', conflicted: [], current: empty })).toMatch(/not an active/);
    expect(assignmentProblem({ person: gone, role: 'lead', conflicted: [], current: empty })).toMatch(/not an active/);
    expect(assignmentProblem({ person: null, role: 'lead', conflicted: [], current: empty })).toMatch(/not an active/);
    expect(assignmentProblem({ person: amara, role: 'lead', conflicted: [], current: { leadId: null, reviewerId: 'a' } })).toMatch(/different people/);
    expect(assignmentProblem({ person: amara, role: 'reviewer', conflicted: [], current: { leadId: 'a', reviewerId: null } })).toMatch(/different people/);
    expect(assignmentProblem({ person: amara, role: 'lead', conflicted: [], current: { leadId: 'a', reviewerId: null } })).toMatch(/already/);
  });
});

describe('computeLoad', () => {
  it('counts leads, reviews, and the waiting evidence of the organisations led', () => {
    const load = computeLoad([
      { orgId: 'o1', userId: 'a', role: 'lead' },
      { orgId: 'o2', userId: 'a', role: 'lead' },
      { orgId: 'o1', userId: 'b', role: 'reviewer' },
    ], { o1: 4, o2: 3 });
    expect(load.get('a')).toEqual({ leads: 2, reviews: 0, waiting: 7 });
    expect(load.get('b')).toEqual({ leads: 0, reviews: 1, waiting: 0 });
  });
});

describe('planAutoAssign', () => {
  it('spreads new organisations across auditors as it goes', () => {
    const plan = planAutoAssign(
      ['o1', 'o2', 'o3', 'o4'].map((id) => ({ id, leadId: null, reviewerId: null, waiting: 0 })),
      [amara, ben], {},
    );
    const leads = plan.filter((p) => p.role === 'lead').map((p) => p.userId);
    expect(leads).toEqual(['a', 'b', 'a', 'b']);
    for (const p of plan.filter((x) => x.role === 'reviewer')) {
      expect(p.userId).not.toBe(plan.find((x) => x.orgId === p.orgId && x.role === 'lead')!.userId);
    }
  });
  it('leaves filled seats alone and fills only the empty one', () => {
    const plan = planAutoAssign([{ id: 'o1', leadId: 'a', reviewerId: null, waiting: 0 }], [amara, ben], {});
    expect(plan).toEqual([{ orgId: 'o1', role: 'reviewer', userId: 'b' }]);
    expect(planAutoAssign([{ id: 'o1', leadId: 'a', reviewerId: 'b', waiting: 0 }], [amara, ben], {})).toEqual([]);
  });
  it('does not make the existing reviewer the lead', () => {
    const plan = planAutoAssign([{ id: 'o1', leadId: null, reviewerId: 'a', waiting: 0 }], [amara, ben], { a: L(0), b: L(5) });
    expect(plan).toEqual([{ orgId: 'o1', role: 'lead', userId: 'b' }]);
  });
  it('respects conflicts per organisation and leaves a seat empty when nobody is eligible', () => {
    const plan = planAutoAssign([{ id: 'o1', leadId: null, reviewerId: null, waiting: 0, conflicted: ['a', 'b'] }], [amara, ben, boss], {});
    expect(plan).toEqual([]);
  });
  it('counts the waiting evidence of an organisation it hands out', () => {
    const plan = planAutoAssign([
      { id: 'busy', leadId: null, reviewerId: null, waiting: 30 },
      { id: 'quiet1', leadId: null, reviewerId: null, waiting: 0 },
      { id: 'quiet2', leadId: null, reviewerId: null, waiting: 0 },
    ], [amara, ben], {});
    const lead = (o: string) => plan.find((p) => p.orgId === o && p.role === 'lead')?.userId;
    expect(lead('busy')).toBe('a');
    expect(lead('quiet1')).toBe('b');
    expect(lead('quiet2')).toBe('b');
  });
});

describe('defaultScope', () => {
  it('auditors with assignments start on their own; everyone else on all', () => {
    expect(defaultScope({ role: 'AIC_AUDITOR', isSuperAdmin: false, assignedCount: 2 })).toBe('mine');
    expect(defaultScope({ role: 'AIC_AUDITOR', isSuperAdmin: false, assignedCount: 0 })).toBe('all');
    expect(defaultScope({ role: 'AIC_SUPER_ADMIN', isSuperAdmin: true, assignedCount: 5 })).toBe('all');
    expect(defaultScope({ role: 'AIC_AUDITOR', isSuperAdmin: true, assignedCount: 5 })).toBe('all');
  });
  it('parses only known scopes', () => {
    expect(parseScope('mine')).toBe('mine');
    expect(parseScope('all')).toBe('all');
    expect(parseScope('everything')).toBeNull();
    expect(parseScope(null)).toBeNull();
  });
});
