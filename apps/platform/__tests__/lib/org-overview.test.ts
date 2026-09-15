import { describe, it, expect } from 'vitest';
import { deriveGaps, type GapFacts } from '../../lib/org-overview';

/**
 * These test the only part of the overview that exercises judgement.
 *
 * The counts around them are arithmetic the database already did. What matters
 * is whether a gap fires when it should, stays quiet when it should not, and is
 * graded at a severity AIC can defend — because a BLOCKING gap is a statement
 * that an organisation cannot be certified today, and that is not a sentence to
 * emit by accident.
 */

const clean: GapFacts = {
  accountablePersons: 2,
  declaredSystems: 3,
  undeclaredButDeciding: [],
  undeclaredButUsing: [],
  systemsWithoutPurpose: [],
  overdueFindings: [],
  evidenceRejected: 0,
  requirementsNotStarted: 0,
  decisions: 1200,
  overrides: 41,
};

const codes = (f: Partial<GapFacts> = {}) => deriveGaps({ ...clean, ...f }).map((g) => g.code);
const bySeverity = (f: Partial<GapFacts>, code: string) =>
  deriveGaps({ ...clean, ...f }).find((g) => g.code === code)?.severity;

describe('deriveGaps', () => {
  it('reports nothing for an organisation with no gaps', () => {
    expect(deriveGaps(clean)).toEqual([]);
  });

  it('blocks when no accountable person is on record', () => {
    expect(codes({ accountablePersons: 0 })).toContain('HU-1-NO-ACCOUNTABLE-PERSON');
    expect(bySeverity({ accountablePersons: 0 }, 'HU-1-NO-ACCOUNTABLE-PERSON')).toBe('BLOCKING');
  });

  it('blocks when a system logs decisions but is not declared', () => {
    const facts = { undeclaredButDeciding: [{ name: 'shadow-scorer', decisions: 84 }] };
    expect(codes(facts)).toContain('HU-3-UNDECLARED-SYSTEM');
    expect(bySeverity(facts, 'HU-3-UNDECLARED-SYSTEM')).toBe('BLOCKING');
  });

  it('names the undeclared system and its volume, because a count alone is unactionable', () => {
    const gap = deriveGaps({
      ...clean,
      undeclaredButDeciding: [
        { name: 'shadow-scorer', decisions: 84 },
        { name: 'triage-bot', decisions: 3 },
      ],
    }).find((g) => g.code === 'HU-3-UNDECLARED-SYSTEM')!;

    expect(gap.detail).toContain('shadow-scorer (84)');
    expect(gap.detail).toContain('triage-bot (3)');
    expect(gap.count).toBe(2);
  });

  it('blocks when usage is attributed to a system that is not declared', () => {
    // Same shape of problem as HU-3-UNDECLARED-SYSTEM, different evidence
    // source: a usage export named a system nobody declared.
    const facts = { undeclaredButUsing: [{ name: 'internal-copilot', provider: 'openai' }] };
    expect(codes(facts)).toContain('HU-3-UNDECLARED-USAGE');
    expect(bySeverity(facts, 'HU-3-UNDECLARED-USAGE')).toBe('BLOCKING');
  });

  it('does not raise HU-3-UNDECLARED-USAGE when usage simply has no system attribution', () => {
    // Absence of attribution is not evidence of an undeclared system - most
    // raw provider usage exports have no concept of "system" at all, and
    // treating silence as a violation would punish every org whose export
    // tooling just doesn't send that field.
    expect(codes({ undeclaredButUsing: [] })).not.toContain('HU-3-UNDECLARED-USAGE');
  });

  it('blocks on an empty inventory', () => {
    expect(codes({ declaredSystems: 0 })).toContain('HU-3-EMPTY-INVENTORY');
  });

  it('treats a missing purpose as material, not blocking', () => {
    const facts = { systemsWithoutPurpose: ['credit-model'] };
    expect(bySeverity(facts, 'EX-1-NO-STATED-PURPOSE')).toBe('MATERIAL');
  });

  it('treats a zero override rate as advisory, not a failing', () => {
    // A genuinely low override rate is a legitimate state. Grading it higher
    // would be AIC telling an organisation how to run its own review process,
    // which is consultancy.
    const facts = { overrides: 0 };
    expect(codes(facts)).toContain('HU-2-ZERO-OVERRIDES');
    expect(bySeverity(facts, 'HU-2-ZERO-OVERRIDES')).toBe('ADVISORY');
  });

  it('does not raise the override gap when nothing has been decided yet', () => {
    // 0 of 0 is not a control that never fired; it is a control with no
    // opportunity to fire. Raising it would punish an organisation for having
    // just switched the logging on.
    expect(codes({ decisions: 0, overrides: 0 })).not.toContain('HU-2-ZERO-OVERRIDES');
  });

  it('orders blocking gaps ahead of material and advisory ones', () => {
    const gaps = deriveGaps({
      accountablePersons: 0,
      declaredSystems: 0,
      undeclaredButDeciding: [{ name: 'x', decisions: 1 }],
      undeclaredButUsing: [],
      systemsWithoutPurpose: ['y'],
      overdueFindings: ['late finding'],
      evidenceRejected: 2,
      requirementsNotStarted: 9,
      decisions: 10,
      overrides: 0,
    });

    const rank = { BLOCKING: 0, MATERIAL: 1, ADVISORY: 2 } as const;
    const ranks = gaps.map((g) => rank[g.severity]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(gaps).toHaveLength(8);
  });

  it('gives every gap a stable code, so the report and the extract agree', () => {
    const all = deriveGaps({
      accountablePersons: 0,
      declaredSystems: 0,
      undeclaredButDeciding: [{ name: 'x', decisions: 1 }],
      undeclaredButUsing: [],
      systemsWithoutPurpose: ['y'],
      overdueFindings: ['z'],
      evidenceRejected: 1,
      requirementsNotStarted: 1,
      decisions: 5,
      overrides: 0,
    });
    const set = new Set(all.map((g) => g.code));
    expect(set.size).toBe(all.length);
    all.forEach((g) => expect(g.code).toMatch(/^[A-Z0-9-]+$/));
  });
});
