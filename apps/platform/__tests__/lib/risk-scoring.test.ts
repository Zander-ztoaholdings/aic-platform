import { describe, it, expect } from 'vitest';
import { inherent, target, current, reviewMonths, nextReviewAt, validateAcceptance, acceptanceExpired, changeEvents, heatmap, type RiskInput } from '@/lib/registers/risk';

const base = { likelihood: 3, impact: 4, residualLikelihood: 2, residualImpact: 4, status: 'treating', treatment: 'mitigate' };

describe('inherent, target and current scores', () => {
  it('inherent is L x I and target is the residual L x I when both are recorded', () => {
    expect(inherent(base)).toEqual({ likelihood: 3, impact: 4, score: 12, level: 'high' });
    expect(target(base)).toEqual({ likelihood: 2, impact: 4, score: 8, level: 'medium' });
    expect(target({ ...base, residualImpact: null })).toBeNull();
  });

  it('current starts from the target once treatment is under way, else from inherent', () => {
    expect(current(base, 0)).toMatchObject({ score: 8, raisedBy: 0 });
    expect(current({ ...base, status: 'open' }, 0)).toMatchObject({ score: 12 });
    expect(current({ ...base, residualLikelihood: null }, 0)).toMatchObject({ score: 12 });
  });

  it('failing evidence raises likelihood by one each, at most two, never past 5', () => {
    expect(current(base, 1)).toMatchObject({ likelihood: 3, score: 12, raisedBy: 1 });
    expect(current(base, 5)).toMatchObject({ likelihood: 4, score: 16, raisedBy: 2 });
    expect(current({ ...base, status: 'open', likelihood: 5 }, 3)).toMatchObject({ likelihood: 5, score: 20, raisedBy: 0 });
    expect(current({ ...base, status: 'closed' }, 3)).toMatchObject({ raisedBy: 0 });
  });

  it('heat map counts open risks only', () => {
    const g = heatmap([{ likelihood: 2, impact: 3, status: 'open' }, { likelihood: 2, impact: 3, status: 'closed' }]);
    expect(g[1][2]).toBe(1);
  });
});

describe('review cadence', () => {
  it('reviews high and critical every 3 months, medium every 6, low every 12', () => {
    expect([reviewMonths(25), reviewMonths(12), reviewMonths(6), reviewMonths(4)]).toEqual([3, 3, 6, 12]);
    expect(nextReviewAt(16, new Date('2026-10-06T00:00:00Z')).toISOString().slice(0, 10)).toBe('2027-01-06');
    expect(nextReviewAt(2, new Date('2026-10-06T00:00:00Z')).toISOString().slice(0, 10)).toBe('2027-10-06');
  });
});

describe('acceptance', () => {
  const today = new Date('2026-10-06T00:00:00Z');
  it('needs an approver, a reason and an expiry within a year', () => {
    expect(validateAcceptance({}, today)).toEqual({ error: 'Name the person who approved accepting this risk.' });
    expect(validateAcceptance({ acceptedBy: 'Naledi Khumalo', acceptReason: 'short' }, today)).toHaveProperty('error');
    expect(validateAcceptance({ acceptedBy: 'Naledi Khumalo', acceptReason: 'Fallback form is enough', acceptUntil: '2026-10-01' }, today)).toHaveProperty('error');
    expect(validateAcceptance({ acceptedBy: 'Naledi Khumalo', acceptReason: 'Fallback form is enough', acceptUntil: '2028-01-01' }, today)).toHaveProperty('error');
    expect(validateAcceptance({ acceptedBy: ' Naledi Khumalo ', acceptReason: 'Fallback form is enough', acceptUntil: '2027-03-31' }, today))
      .toEqual({ value: { acceptedBy: 'Naledi Khumalo', acceptReason: 'Fallback form is enough', acceptUntil: '2027-03-31' } });
  });
  it('knows when an acceptance has run out', () => {
    expect(acceptanceExpired('2026-10-05', today)).toBe(true);
    expect(acceptanceExpired('2026-10-06', today)).toBe(false);
    expect(acceptanceExpired(null, today)).toBe(false);
  });
});

describe('change events', () => {
  const a: RiskInput = { title: 'Drift', description: null, category: 'ai', likelihood: 3, impact: 4, residualLikelihood: null, residualImpact: null, treatment: 'mitigate', treatmentPlan: 'Watch it', controls: [], ownerName: 'Pieter', status: 'open', reviewAt: null };
  it('records nothing when nothing that matters changed', () => {
    expect(changeEvents(a, { ...a, ownerName: 'Ayesha' })).toEqual([]);
  });
  it('records score, treatment, closing and reopening', () => {
    expect(changeEvents(a, { ...a, likelihood: 4 }).map((e) => e.kind)).toEqual(['scored']);
    expect(changeEvents(a, { ...a, likelihood: 4 })[0].detail).toMatchObject({ from: { score: 12 }, to: { score: 16 } });
    const acc = { acceptedBy: 'Naledi', acceptReason: 'Within appetite', acceptUntil: '2027-01-01' };
    const t = changeEvents(a, { ...a, treatment: 'accept', status: 'accepted' }, { before: null, after: acc });
    expect(t.map((e) => e.kind)).toEqual(['treatment']);
    expect(t[0].detail).toMatchObject({ from: 'mitigate', to: 'accept', acceptedBy: 'Naledi' });
    const acceptedA = { ...a, treatment: 'accept', status: 'accepted' };
    expect(changeEvents(acceptedA, acceptedA, { before: acc, after: acc })).toEqual([]);
    expect(changeEvents(a, { ...a, status: 'closed' }).map((e) => e.kind)).toEqual(['closed']);
    expect(changeEvents({ ...a, status: 'closed' }, a).map((e) => e.kind)).toEqual(['reopened']);
  });
});
