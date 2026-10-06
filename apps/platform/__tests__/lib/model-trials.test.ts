import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import { writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { validateTrial, trialVerdict, median, aggregateTrial, matchTrial, latestPerPair, suggestJudge } from '@/lib/model-trials';
import { MODEL_TRIAL_SCRIPT } from '@/lib/model-trial-script';

const ok = { fromModel: 'claude-sonnet-4-5', toModel: 'claude-sonnet-5-5', method: 'judge_pairwise', samples: 50, asGood: 47, worse: 2, failed: 1, fromCostUsd: 0.4, toCostUsd: 0.27, fromLatencyMs: 2100, toLatencyMs: 1800 };

describe('validateTrial', () => {
  it('accepts a consistent trial', () => expect(validateTrial(ok).ok).toBe(true));
  it('refuses counts that do not add up', () => expect(validateTrial({ ...ok, worse: 5 })).toMatchObject({ ok: false }));
  it('refuses the same model twice and unknown methods', () => {
    expect(validateTrial({ ...ok, toModel: 'Claude-Sonnet-4-5' }).ok).toBe(false);
    expect(validateTrial({ ...ok, method: 'vibes' }).ok).toBe(false);
  });
  it('carries no prompts: unknown fields are dropped', () => {
    const v = validateTrial({ ...ok, prompts: ['secret'] });
    expect(v.ok && 'prompts' in v.value).toBe(false);
  });
});

describe('verdicts and aggregation', () => {
  it('passes at 90% as good with few failures', () => {
    expect(trialVerdict(ok).verdict).toBe('passed');
    const mixed = { ...ok, asGood: 40, worse: 9 };
    expect(trialVerdict(mixed).verdict).toBe('mixed');
    const failing = { ...ok, asGood: 20, worse: 29 };
    expect(trialVerdict(failing).verdict).toBe('failed');
  });
  it('takes medians', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(3);
    expect(median([])).toBeNull();
  });
  it('aggregates sample results into what is sent', () => {
    const r = aggregateTrial('claude-sonnet-4-5', 'claude-sonnet-5-5', [
      { verdict: 'as_good', hasReference: false, from: { ms: 100, inputTokens: 1000, outputTokens: 100 }, to: { ms: 80, inputTokens: 1000, outputTokens: 100 } },
      { verdict: 'worse', hasReference: false, from: { ms: 300, inputTokens: 1000, outputTokens: 100 }, to: { ms: 60, inputTokens: 1000, outputTokens: 100 } },
      { verdict: 'failed', hasReference: false, from: null, to: null },
    ]);
    expect(r).toMatchObject({ samples: 3, asGood: 1, worse: 1, failed: 1, method: 'judge_pairwise', fromLatencyMs: 200, toLatencyMs: 70 });
    expect(r.toCostUsd!).toBeLessThan(r.fromCostUsd!);
    expect(validateTrial(r).ok).toBe(true);
  });
  it('matches trials to suggestions by model, newest first', () => {
    const trials = [{ ...ok, id: 2 }, { ...ok, id: 1 }];
    expect(latestPerPair(trials)).toHaveLength(1);
    expect(matchTrial(trials, 'claude-sonnet-4-5-20250929', 'claude-sonnet-5-5')).toMatchObject({ id: 2 });
  });
  it('never suggests the cheaper model as its own judge', () => {
    expect(suggestJudge('claude-sonnet-4-5', 'claude-sonnet-5-5')).not.toBe('claude-sonnet-5-5');
  });
});

describe('the trial script', () => {
  it('is valid JavaScript and never sends prompts', () => {
    const dir = mkdtempSync(join(tmpdir(), 'aic-trial-'));
    const f = join(dir, 'aic-model-trial.mjs');
    writeFileSync(f, MODEL_TRIAL_SCRIPT);
    expect(() => execFileSync(process.execPath, ['--check', f])).not.toThrow();
    // The only request to AIC carries the aggregate built by aggregateTrial, nothing else.
    const toAic = MODEL_TRIAL_SCRIPT.slice(MODEL_TRIAL_SCRIPT.indexOf("AIC_URL + '/api/v1/model-trials'"));
    expect(toAic).toMatch(/body: JSON\.stringify\(trial\)/);
  });
});
