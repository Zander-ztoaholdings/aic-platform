import { describe, it, expect } from 'vitest';
import { outcomeOptions, reasonOptions, composeNote, shapeOutcome, outcomeLabel, STANDARD_REASONS, OTHER_REASON } from '@/lib/override';

const rows = [
  { systemName: 'credit', outcome: { decision: 'declined' } },
  { systemName: 'credit', outcome: { decision: 'approved' } },
  { systemName: 'credit', outcome: { decision: 'approved' } },
  { systemName: 'credit', outcome: { decision: 'refer' }, isHumanOverride: true, overrideReason: 'Payslip not yet loaded: client sent it by email', finalOutcome: { decision: 'approved' } },
  { systemName: 'credit', outcome: 'declined', isHumanOverride: true, overrideReason: 'Payslip not yet loaded' },
  { systemName: 'fraud', outcome: 'block' },
];

describe('override shortcuts', () => {
  it('offers the other outcomes this system produces, most common first', () => {
    expect(outcomeOptions(rows, 'credit', { decision: 'declined' })).toEqual(['approved', 'refer']);
    expect(outcomeOptions(rows, 'fraud', 'block')).toEqual([]);
  });
  it('offers reasons used before for this system, then the standard ones', () => {
    const r = reasonOptions(rows, 'credit');
    expect(r[0]).toBe('Payslip not yet loaded');
    expect(r).toHaveLength(6);
    expect(reasonOptions(rows, 'fraud')).toEqual([...STANDARD_REASONS]);
  });
  it('builds the note; "something else" needs words', () => {
    expect(composeNote('The system was wrong', '')).toEqual({ note: 'The system was wrong' });
    expect(composeNote('The system was wrong', 'score ignored new income')).toEqual({ note: 'The system was wrong: score ignored new income' });
    expect(composeNote(OTHER_REASON, 'short')).toHaveProperty('error');
    expect(composeNote(null, 'x')).toHaveProperty('error');
  });
  it('keeps the shape of the original outcome', () => {
    expect(shapeOutcome({ decision: 'declined', score: 3 }, 'approved')).toEqual({ decision: 'approved' });
    expect(shapeOutcome('declined', 'approved')).toBe('approved');
    expect(outcomeLabel({ score: 3 })).toBeNull();
  });
});
