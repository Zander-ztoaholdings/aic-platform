import { describe, it, expect } from 'vitest';
import { STAGES, STAGE_LABEL, STAGE_MEANING, validateCreate, validateUpdate, validateDelete, summarise, isOverdue } from '@/lib/markets';

describe('stages', () => {
  it('runs in order and every stage has a label and a meaning', () => {
    expect(STAGES).toEqual(['watching', 'mapped', 'preparing', 'entering', 'live', 'paused']);
    for (const s of STAGES) { expect(STAGE_LABEL[s]).toBeTruthy(); expect(STAGE_MEANING[s]).toBeTruthy(); }
  });
});

describe('validateCreate', () => {
  it('accepts a minimal market and defaults to watching', () => {
    const r = validateCreate({ code: 'na', name: 'Namibia' });
    expect('value' in r && r.value).toMatchObject({ code: 'NA', name: 'Namibia', stage: 'watching', law: null, nextStepDue: null });
  });
  it('rejects a missing name or bad code', () => {
    expect(validateCreate({ code: 'NA', name: '' })).toHaveProperty('error');
    expect(validateCreate({ code: 'Namibia!', name: 'Namibia' })).toHaveProperty('error');
  });
  it('rejects an unknown stage and an impossible date', () => {
    expect(validateCreate({ code: 'NA', name: 'Namibia', stage: 'booming' })).toHaveProperty('error');
    expect(validateCreate({ code: 'NA', name: 'Namibia', nextStepDue: '2026-02-30' })).toHaveProperty('error');
  });
  it('trims text and keeps a valid due date', () => {
    const r = validateCreate({ code: 'KE', name: ' Kenya ', regulator: '  ODPC ', nextStepDue: '2026-11-01' });
    expect('value' in r && r.value).toMatchObject({ name: 'Kenya', regulator: 'ODPC', nextStepDue: '2026-11-01' });
  });
});

describe('validateUpdate', () => {
  it('needs a note of at least 10 characters to move stage', () => {
    expect(validateUpdate({ stage: 'preparing' }, 'mapped')).toHaveProperty('error');
    expect(validateUpdate({ stage: 'preparing', note: 'too short' }, 'mapped')).toHaveProperty('error');
    const r = validateUpdate({ stage: 'preparing', note: 'Partner meeting booked' }, 'mapped');
    expect('value' in r && r.value).toMatchObject({ stage: 'preparing', note: 'Partner meeting booked' });
  });
  it('treats the current stage as no move', () => {
    const r = validateUpdate({ stage: 'mapped', ownerName: 'Zander' }, 'mapped');
    expect('value' in r && r.value).toMatchObject({ stage: null, fields: { ownerName: 'Zander' } });
  });
  it('changes only fields present and clears a field set to empty', () => {
    const r = validateUpdate({ nextStep: '' }, 'live');
    expect('value' in r && r.value.fields).toEqual({ nextStep: null });
  });
  it('rejects an empty edit', () => {
    expect(validateUpdate({}, 'live')).toHaveProperty('error');
  });
});

describe('validateDelete', () => {
  it('refuses anything past watching with 409', () => {
    expect(validateDelete('mapped', 'Added by mistake')).toMatchObject({ status: 409 });
  });
  it('needs a reason', () => {
    expect(validateDelete('watching', '')).toMatchObject({ status: 400 });
    expect(validateDelete('watching', 'Added twice by mistake')).toEqual({ reason: 'Added twice by mistake' });
  });
});

describe('summarise', () => {
  const rows = [
    { id: '1', name: 'South Africa', stage: 'live', nextStep: 'Renew', nextStepDue: '2026-10-01' },
    { id: '2', name: 'Botswana', stage: 'mapped', nextStep: 'Call regulator', nextStepDue: '2026-09-01' },
    { id: '3', name: 'Mauritius', stage: 'mapped', nextStep: null, nextStepDue: null },
    { id: '4', name: 'Kenya', stage: 'paused', nextStep: 'Revisit', nextStepDue: '2026-01-01' },
    { id: '5', name: 'Zambia', stage: 'watching', nextStep: 'Read the act', nextStepDue: '2026-10-06' },
  ];
  it('counts per stage, including zeros', () => {
    const s = summarise(rows, '2026-10-06');
    expect(s.counts).toEqual({ watching: 1, mapped: 2, preparing: 0, entering: 0, live: 1, paused: 1 });
    expect(s.total).toBe(5);
  });
  it('lists overdue next steps oldest first, skipping paused markets and today', () => {
    const s = summarise(rows, '2026-10-06');
    expect(s.overdue.map((o) => o.id)).toEqual(['2', '1']);
  });
  it('isOverdue is false without a date', () => {
    expect(isOverdue({ stage: 'live', nextStepDue: null }, '2026-10-06')).toBe(false);
  });
  it('handles an empty board', () => {
    expect(summarise([], '2026-10-06')).toMatchObject({ total: 0, overdue: [] });
  });
});
