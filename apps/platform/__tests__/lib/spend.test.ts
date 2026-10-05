import { describe, it, expect } from 'vitest';
import { summariseSpend, isPremium } from '@/lib/spend';

const now = new Date('2026-10-20T10:00:00Z');
const day = (n: number) => new Date(now.getTime() - n * 86_400_000);
const row = (n: number, cost: number | null, extra: Partial<{ model: string; systemName: string | null; requests: number; outputTokens: number }> = {}) => ({
  provider: 'openai', model: extra.model ?? 'gpt-4o', systemName: extra.systemName === undefined ? 'Claims' : extra.systemName,
  periodStart: day(n), requests: extra.requests ?? 100, inputTokens: 1000, outputTokens: extra.outputTokens ?? 100000, costUsd: cost,
});

describe('AI spend', () => {
  it('knows premium from small models', () => {
    expect(isPremium('gpt-4o-2024-08-06')).toBe(true);
    expect(isPremium('gpt-4o-mini')).toBe(false);
    expect(isPremium('claude-haiku-4-5')).toBe(false);
    expect(isPremium('claude-sonnet-4-5')).toBe(true);
    expect(isPremium('o3-mini')).toBe(false);
  });

  it('totals month to date, projects, and flags the budget', () => {
    const rows = Array.from({ length: 19 }, (_, i) => row(i + 1, 10));
    const s = summariseSpend(rows, now, 300);
    expect(s.monthToDate).toBeCloseTo(190, 5);
    expect(s.projected).toBeCloseTo((190 / 19) * 31, 5);
    expect(s.flags.some((f) => f.kind === 'budget')).toBe(true);
    expect(s.daily).toHaveLength(30);
  });

  it('flags a premium model used for short answers, and unattributed spend', () => {
    const rows = Array.from({ length: 10 }, (_, i) => row(i + 1, 5, { requests: 50, outputTokens: 5000, systemName: null }));
    const s = summariseSpend(rows, now, null);
    expect(s.flags.find((f) => f.kind === 'premium_short')?.title).toContain('gpt-4o');
    expect(s.flags.some((f) => f.kind === 'unattributed')).toBe(true);
  });

  it('notes usage without a cost and flags a spike', () => {
    const rows = [
      ...Array.from({ length: 21 }, (_, i) => row(i + 8, 2)),
      ...Array.from({ length: 7 }, (_, i) => row(i + 1, 10)),
      row(2, null, { model: 'o3-mini' }),
    ];
    const s = summariseSpend(rows, now, null);
    expect(s.flags.some((f) => f.kind === 'no_cost')).toBe(true);
    expect(s.flags.some((f) => f.kind === 'spike')).toBe(true);
  });
});
