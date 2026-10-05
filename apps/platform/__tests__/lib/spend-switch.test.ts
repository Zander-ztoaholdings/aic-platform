import { describe, it, expect } from 'vitest';
import { findPrice, adviseModels, totalSaving, costAt } from '@/lib/spend-switch';
import { MODEL_PRICES, SWITCHES } from '@/lib/ai-prices';

const NOW = new Date('2026-10-05T12:00:00Z');
const use = (model: string, provider: string, inputTokens: number, outputTokens: number, requests = 1000) => {
  const p = findPrice(model)!;
  return { model, provider, inputTokens, outputTokens, requests, cost: p && p.inputPerM !== null ? costAt(p as never, inputTokens, outputTokens) : 0 };
};

describe('findPrice', () => {
  it('matches ids, aliases and dated names', () => {
    expect(findPrice('claude-sonnet-4-5')?.id).toBe('claude-sonnet-4-5-20250929');
    expect(findPrice('gpt-4o-2024-08-06')?.id).toBe('gpt-4o');
    expect(findPrice('GPT-6-LUNA')?.id).toBe('gpt-6-luna');
    expect(findPrice('mistral-small-latest')?.id).toBe('mistral-small-2603');
    expect(findPrice('my-own-model')).toBeNull();
  });
  it('every suggested switch names models that are in the price list', () => {
    for (const s of SWITCHES) {
      expect(findPrice(s.from), s.from).not.toBeNull();
      expect(findPrice(s.to)?.status, s.to).toBe('active');
    }
  });
  it('every replacement named by a provider is in the price list', () => {
    for (const m of MODEL_PRICES) if (m.replacement) expect(findPrice(m.replacement), `${m.id} → ${m.replacement}`).not.toBeNull();
  });
});

describe('adviseModels', () => {
  it('warns about a retiring model and prices its successor', () => {
    const [a] = adviseModels([use('claude-sonnet-4-5', 'anthropic', 40e6, 8e6)], NOW);
    expect(a.ending).toMatchObject({ status: 'deprecated', on: '2026-11-30', daysLeft: 56 });
    expect(a.options[0]).toMatchObject({ to: 'claude-sonnet-5-5', kind: 'replacement' });
    // $3/$15 → $2/$10: 40×3 + 8×15 = 240 against 40×2 + 8×10 = 160
    expect(a.options[0].estimate).toBeCloseTo(160);
    expect(a.options[0].saving).toBeCloseTo(80);
  });
  it('suggests a smaller model from the same provider, and says when the answers are short', () => {
    const [a] = adviseModels([use('gpt-4o', 'openai', 30e6, 0.2e6, 2000)], NOW);
    const luna = a.options.find((o) => o.to === 'gpt-6-luna')!;
    expect(luna.kind).toBe('same_provider');
    expect(luna.reason).toMatch(/average 100 tokens/);
    expect(a.ending).toBeNull();
  });
  it('leaves out small savings', () => {
    const [a] = adviseModels([use('gpt-4o', 'openai', 100_000, 10_000)], NOW);
    expect(a.options).toHaveLength(0);
  });
  it('flags a different provider with the supplier caveat', () => {
    const [a] = adviseModels([use('claude-opus-5-5', 'anthropic', 50e6, 10e6)], NOW);
    const other = a.options.find((o) => o.kind === 'other_provider');
    if (other) expect(other.reason).toMatch(/data processing agreement/);
    expect(a.options.some((o) => o.to === 'claude-sonnet-5-5')).toBe(true);
  });
  it('does not compare a model it has no price for, and totals only same-provider savings', () => {
    const advice = adviseModels([use('claude-sonnet-4-5', 'anthropic', 40e6, 8e6), { model: 'in-house-v2', provider: 'other', inputTokens: 1e6, outputTokens: 1e6, requests: 10, cost: 50 }], NOW);
    expect(advice.find((a) => a.model === 'in-house-v2')?.matched).toBeNull();
    expect(totalSaving(advice)).toBeGreaterThanOrEqual(80);
  });
});
