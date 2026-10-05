import { describe, it, expect } from 'vitest';
import { score, level, heatmap, validateRisk } from '@/lib/registers/risk';
import { supplierState, supplierFlags, nextReview, cleanSupplier } from '@/lib/registers/suppliers';
import { cleanPerson, parsePeopleCsv } from '@/lib/registers/people';
import { MODULES, scoreQuiz, isCurrent } from '@/lib/training/modules';
import { leaversWithAccess, type Account } from '@/lib/registers/accounts';
import { COMMON_BY_KEY } from '@/lib/common-controls';

describe('risk register', () => {
  it('scores and bands on the 5x5 grid', () => {
    expect(score(4, 5)).toBe(20);
    expect([level(4), level(5), level(12), level(20)]).toEqual(['low', 'medium', 'high', 'critical']);
    const g = heatmap([{ likelihood: 4, impact: 5, status: 'open' }, { likelihood: 4, impact: 5, status: 'closed' }]);
    expect(g[3][4]).toBe(1);
  });
  it('validates and keeps only known controls', () => {
    expect(validateRisk({ title: 'x', likelihood: 3, impact: 3 }, new Set())).toHaveProperty('error');
    expect(validateRisk({ title: 'Model drift', likelihood: 6, impact: 3 }, new Set())).toHaveProperty('error');
    const v = validateRisk({ title: 'Model drift', likelihood: '3', impact: 4, controls: ['ai.monitoring', 'nope'], reviewAt: '2026-12-01' }, new Set(Object.keys(COMMON_BY_KEY)));
    expect(v).toMatchObject({ value: { likelihood: 3, impact: 4, controls: ['ai.monitoring'] } });
  });
});

describe('supplier register', () => {
  it('states and review dates follow criticality', () => {
    expect(supplierState({ nextReviewAt: null, lastOutcome: null })).toBe('not_reviewed');
    expect(supplierState({ nextReviewAt: '2020-01-01', lastOutcome: 'approved' })).toBe('due');
    expect(supplierState({ nextReviewAt: '2099-01-01', lastOutcome: 'approved' })).toBe('current');
    expect(nextReview('high', new Date('2026-01-15')).toISOString().slice(0, 10)).toBe('2027-01-15');
  });
  it('flags personal information without an agreement', () => {
    expect(supplierFlags({ dataShared: ['personal'], outsideSa: true, hasDpa: false, criticality: 'high' })).toHaveLength(2);
    expect(supplierFlags({ dataShared: ['personal'], outsideSa: true, hasDpa: true, criticality: 'high' })).toEqual([]);
    expect(cleanSupplier({ name: 'X', website: 'x.com' })).toHaveProperty('error');
  });
});

describe('people', () => {
  it('validates dates and imports a CSV with matched columns', () => {
    expect(cleanPerson({ name: 'A', startDate: '2026-02-01', endDate: '2026-01-01' })).toHaveProperty('error');
    const r = parsePeopleCsv('Full name,Work email,Job title,Termination date\n"Doe, Jane",jane@x.co,Analyst,2026-09-30\n,missing@x.co,,\n');
    expect(r).toMatchObject({ people: [{ name: 'Doe, Jane', email: 'jane@x.co', jobTitle: 'Analyst', endDate: '2026-09-30' }], skipped: 1 });
  });
  it('finds leavers who still have an enabled account', () => {
    const acc: Account[] = [
      { system: 'Microsoft 365', account: 'jane@x.co', displayName: 'Jane Doe', privilege: 'Member', lastActiveAt: null, enabled: true },
      { system: 'GitHub', account: 'jane', displayName: null, privilege: 'Member', lastActiveAt: null, enabled: true },
      { system: 'Microsoft 365', account: 'sam@x.co', displayName: 'Sam', privilege: 'Member', lastActiveAt: null, enabled: false },
    ];
    const r = leaversWithAccess([{ name: 'Jane Doe', email: 'jane@x.co', endDate: '2026-09-30' }, { name: 'Sam', email: 'sam@x.co', endDate: '2026-09-01' }, { name: 'Lee', email: 'lee@x.co', endDate: null }], acc, '2026-10-05');
    expect(r).toHaveLength(1);
    expect(r[0].accounts.map((a) => a.system)).toEqual(['Microsoft 365', 'GitHub']);
  });
});

describe('training', () => {
  it('every module has four answerable questions and real controls', () => {
    for (const m of MODULES) {
      expect(m.quiz).toHaveLength(4);
      for (const q of m.quiz) expect(q.answer).toBeLessThan(q.options.length);
      for (const k of m.controls) expect(COMMON_BY_KEY[k], k).toBeDefined();
    }
  });
  it('passes at three of four and expires after the period', () => {
    const m = MODULES[0];
    expect(scoreQuiz(m, m.quiz.map((q) => q.answer)).passed).toBe(true);
    expect(scoreQuiz(m, [m.quiz[0].answer, m.quiz[1].answer, m.quiz[2].answer, 99]).passed).toBe(true);
    expect(scoreQuiz(m, [m.quiz[0].answer, 99, 99, 99]).passed).toBe(false);
    expect(isCurrent('2025-01-01', 12, Date.parse('2026-10-05'))).toBe(false);
    expect(isCurrent('2026-06-01', 12, Date.parse('2026-10-05'))).toBe(true);
  });
});
