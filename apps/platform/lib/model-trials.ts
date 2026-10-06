/**
 * Model trials: the score a client gets by testing a cheaper model on its own
 * requests, on its own machine.
 *
 * AIC never sees prompts or answers, so it cannot test a model itself. The
 * client downloads aic-model-trial.mjs (lib/model-trial-script.ts), runs it
 * with its own provider key over a file of its own sample requests, and the
 * script sends AIC only the counts below: how many answers a judge model
 * found as good, worse, or could not score, plus cost and median latency.
 *
 * The scoring and aggregation here (median, aggregateTrial) are duplicated
 * inside the script, which must run with no dependencies. Keep the two in
 * step; this copy is the tested one.
 *
 * Pure: tested in __tests__/lib/model-trials.test.ts.
 */
import { findPrice, priced, costAt } from './spend-switch';

export const TRIAL_METHODS = ['judge_reference', 'judge_pairwise'] as const;
export type TrialMethod = (typeof TRIAL_METHODS)[number];
export const MAX_SAMPLES = 10_000;
export const MAX_MODEL_LENGTH = 120;

export type TrialInput = {
  fromModel: string;
  toModel: string;
  method: TrialMethod;
  samples: number;
  asGood: number;
  worse: number;
  failed: number;
  fromCostUsd: number | null;
  toCostUsd: number | null;
  fromLatencyMs: number | null;
  toLatencyMs: number | null;
};

export type TrialVerdict = 'passed' | 'mixed' | 'failed';

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

/** Checks a trial as the script sends it. Returns the clean value or a sentence saying what is wrong. */
export function validateTrial(body: unknown): { ok: true; value: TrialInput } | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'Send the trial as a JSON object.' };
  const b = body as Record<string, unknown>;
  const model = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const fromModel = model(b.fromModel);
  const toModel = model(b.toModel);
  if (!fromModel || !toModel) return { ok: false, error: 'fromModel and toModel are both needed.' };
  if (fromModel.length > MAX_MODEL_LENGTH || toModel.length > MAX_MODEL_LENGTH) return { ok: false, error: `Model names can be at most ${MAX_MODEL_LENGTH} characters.` };
  if (fromModel.toLowerCase() === toModel.toLowerCase()) return { ok: false, error: 'fromModel and toModel must be different models.' };
  if (typeof b.method !== 'string' || !(TRIAL_METHODS as readonly string[]).includes(b.method)) return { ok: false, error: `method must be one of ${TRIAL_METHODS.join(', ')}.` };
  const { samples, asGood, worse, failed } = b;
  if (!isCount(samples) || samples < 1 || samples > MAX_SAMPLES) return { ok: false, error: `samples must be a whole number from 1 to ${MAX_SAMPLES}.` };
  if (!isCount(asGood) || !isCount(worse) || !isCount(failed)) return { ok: false, error: 'asGood, worse and failed must be whole numbers, zero or more.' };
  if (asGood + worse + failed !== samples) return { ok: false, error: 'asGood, worse and failed must add up to samples.' };

  const cost = (v: unknown, name: string): number | null | string => {
    if (v === undefined || v === null) return null;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v >= 1_000_000) return `${name} must be a number of US dollars, or null.`;
    return v;
  };
  const latency = (v: unknown, name: string): number | null | string => {
    if (v === undefined || v === null) return null;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 86_400_000) return `${name} must be milliseconds, or null.`;
    return Math.round(v);
  };
  const fromCostUsd = cost(b.fromCostUsd, 'fromCostUsd');
  const toCostUsd = cost(b.toCostUsd, 'toCostUsd');
  const fromLatencyMs = latency(b.fromLatencyMs, 'fromLatencyMs');
  const toLatencyMs = latency(b.toLatencyMs, 'toLatencyMs');
  for (const v of [fromCostUsd, toCostUsd, fromLatencyMs, toLatencyMs]) if (typeof v === 'string') return { ok: false, error: v };

  return {
    ok: true,
    value: {
      fromModel, toModel, method: b.method as TrialMethod, samples, asGood, worse, failed,
      fromCostUsd: fromCostUsd as number | null, toCostUsd: toCostUsd as number | null,
      fromLatencyMs: fromLatencyMs as number | null, toLatencyMs: toLatencyMs as number | null,
    },
  };
}

/** Passed, mixed or failed, with the result in one plain sentence. */
export function trialVerdict(t: { fromModel: string; samples: number; asGood: number; failed: number }): { verdict: TrialVerdict; sentence: string } {
  const good = t.samples > 0 ? t.asGood / t.samples : 0;
  const bad = t.samples > 0 ? t.failed / t.samples : 1;
  const verdict: TrialVerdict = good >= 0.9 && bad <= 0.05 ? 'passed' : good >= 0.7 ? 'mixed' : 'failed';
  const sentence = `${t.asGood} of ${t.samples} answers were judged as good as ${t.fromModel}’s`
    + (t.failed > 0 ? `, and ${t.failed} could not be scored.` : '.');
  return { verdict, sentence };
}

/** The middle value, or null for none. Even counts take the mean of the two middle values, rounded. */
export function median(values: number[]): number | null {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return Math.round(v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2);
}

/** One sample's outcome, as the script records it on the client's machine. */
export type SampleResult = {
  verdict: 'as_good' | 'worse' | 'failed';
  hasReference: boolean;
  /** Present when the model answered. */
  from?: { ms: number; inputTokens: number; outputTokens: number } | null;
  to?: { ms: number; inputTokens: number; outputTokens: number } | null;
};

type PriceFn = (model: string) => { inputPerM: number; outputPerM: number } | null;

/** AIC's own price list, for the lib copy. The script carries a small table built from the same list. */
export const listPrice: PriceFn = (model) => {
  const p = findPrice(model);
  return priced(p) ? { inputPerM: p.inputPerM, outputPerM: p.outputPerM } : null;
};

/**
 * The counts the script sends. Cost and latency are taken over the samples
 * where both models answered, so the two figures compare like with like.
 */
export function aggregateTrial(fromModel: string, toModel: string, results: SampleResult[], price: PriceFn = listPrice): TrialInput {
  const both = results.filter((r) => r.from && r.to);
  const sum = (side: 'from' | 'to', model: string) => {
    const p = price(model);
    if (!p || both.length === 0) return null;
    const c = both.reduce((n, r) => n + costAt(p, r[side]!.inputTokens, r[side]!.outputTokens), 0);
    return Math.round(c * 1e6) / 1e6;
  };
  return {
    fromModel,
    toModel,
    method: results.length > 0 && results.every((r) => r.hasReference) ? 'judge_reference' : 'judge_pairwise',
    samples: results.length,
    asGood: results.filter((r) => r.verdict === 'as_good').length,
    worse: results.filter((r) => r.verdict === 'worse').length,
    failed: results.filter((r) => r.verdict === 'failed').length,
    fromCostUsd: sum('from', fromModel),
    toCostUsd: sum('to', toModel),
    fromLatencyMs: median(both.map((r) => r.from!.ms)),
    toLatencyMs: median(both.map((r) => r.to!.ms)),
  };
}

/** Two names for the same model: equal ignoring case, or the same entry in AIC's price list. */
export function sameModel(a: string, b: string): boolean {
  if (a.trim().toLowerCase() === b.trim().toLowerCase()) return true;
  const pa = findPrice(a);
  return !!pa && pa.id === findPrice(b)?.id;
}

/** The newest trial for each from-to pair. Expects trials newest first. */
export function latestPerPair<T extends { fromModel: string; toModel: string }>(trials: T[]): T[] {
  const seen = new Set<string>();
  return trials.filter((t) => {
    const k = `${t.fromModel.toLowerCase()}|${t.toModel.toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** The trial that tested this switch, if any. Expects trials newest first. */
export function matchTrial<T extends { fromModel: string; toModel: string }>(trials: T[], fromModel: string, toModel: string): T | null {
  return trials.find((t) => sameModel(t.fromModel, fromModel) && sameModel(t.toModel, toModel)) ?? null;
}

/** The script calls Anthropic for claude models and OpenAI for gpt and o-series models. */
export const scriptSupports = (model: string) => /^(claude|gpt|o)/i.test(model.trim());

/**
 * A judge to suggest: the model in use today when it still runs (it is the
 * one the client already trusts), otherwise a current top model from the same
 * provider. Never the cheaper model itself, which would be marking its own work.
 */
export function suggestJudge(fromModel: string, toModel: string): string {
  const p = findPrice(fromModel);
  if (p && p.status === 'active' && scriptSupports(fromModel) && !sameModel(fromModel, toModel)) return fromModel;
  const anthropic = /^claude/i.test(toModel) || (!/^(gpt|o)/i.test(toModel) && /^claude/i.test(fromModel));
  const pick = anthropic ? 'claude-opus-5-5' : 'gpt-5.6-sol';
  return sameModel(pick, toModel) ? (anthropic ? 'claude-opus-5' : 'gpt-5.5') : pick;
}
