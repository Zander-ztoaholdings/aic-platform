/**
 * Model switch recommendations: for each model an organisation pays for,
 * what the same usage would cost on another model, and whether its current
 * model is about to stop working.
 *
 * The arithmetic uses the organisation's real token mix from the last 30
 * days and list prices (lib/ai-prices). It is an estimate of the bill, not
 * a promise: AIC never sees prompts or answers, so it cannot say whether a
 * cheaper model is good enough. Every suggestion says so, and says to test
 * first. A switch to a different provider also means a new supplier, so it
 * carries the supplier review and, for personal information sent abroad,
 * the POPIA s72 agreement.
 *
 * Pure: tested in __tests__/lib/spend-switch.test.ts.
 */
import { MODEL_PRICES, SWITCHES, type ModelPrice } from './ai-prices';

export type ModelUsage = { model: string; provider: string; cost: number; requests: number; inputTokens: number; outputTokens: number };

export type SwitchOption = {
  to: string;
  provider: string;
  tier: string;
  /** Estimated cost of the same 30 days of tokens on this model. */
  estimate: number;
  saving: number;
  savingShare: number;
  reason: string;
  kind: 'replacement' | 'same_provider' | 'other_provider';
  promoUntil: string | null;
};

export type ModelAdvice = {
  model: string;
  provider: string;
  matched: string | null;
  tier: string | null;
  cost: number;
  /** The same tokens at list price, so options compare like with like. */
  listEstimate: number | null;
  avgOutputTokens: number | null;
  ending: { on: string | null; status: 'deprecated' | 'retired'; daysLeft: number | null } | null;
  options: SwitchOption[];
};

const PROVIDER_NAME: Record<string, string> = { openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google', mistral: 'Mistral' };
export const providerName = (p: string) => PROVIDER_NAME[p] ?? p;

const stripDate = (id: string) => id.toLowerCase().replace(/-(\d{4}-\d{2}-\d{2}|\d{8})$/, '');

/** The price entry for a model name as a provider reports it: exact id, alias, the id without a date stamp, or the longest id it starts with. */
export function findPrice(model: string, prices: ModelPrice[] = MODEL_PRICES): ModelPrice | null {
  const m = model.trim().toLowerCase();
  const exact = prices.find((p) => p.id === m || p.aliases.includes(m));
  if (exact) return exact;
  const bare = stripDate(m);
  const byBare = prices.find((p) => stripDate(p.id) === bare || p.aliases.some((a) => stripDate(a) === bare));
  if (byBare) return byBare;
  const prefix = prices.filter((p) => m.startsWith(p.id + '-')).sort((a, b) => b.id.length - a.id.length)[0];
  return prefix ?? null;
}

export const priced = (p: ModelPrice | null | undefined): p is ModelPrice & { inputPerM: number; outputPerM: number } => !!p && p.inputPerM !== null && p.outputPerM !== null;

export const costAt = (p: { inputPerM: number; outputPerM: number }, inputTokens: number, outputTokens: number) => (inputTokens / 1e6) * p.inputPerM + (outputTokens / 1e6) * p.outputPerM;

const TIER_RANK: Record<string, number> = { small: 0, mid: 1, frontier: 2 };

/** Follows a provider's replacement chain to a model that still runs. */
function liveReplacement(p: ModelPrice, prices: ModelPrice[]): ModelPrice | null {
  const seen = new Set<string>();
  let cur: ModelPrice | null = p;
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    const named: string | undefined = cur.replacement ?? SWITCHES.find((s) => s.from === cur!.id || findPrice(s.from, prices)?.id === cur!.id)?.to;
    const next: ModelPrice | null = named ? findPrice(named, prices) : null;
    if (!next) break;
    if (next.status === 'active') return next;
    cur = next;
  }
  // No named successor: the current model in the same tier from the same provider, cheapest first.
  return prices.filter((x) => x.provider === p.provider && x.tier === p.tier && x.status === 'active' && priced(x))
    .sort((a, b) => costAt(a as never, 1, 1) - costAt(b as never, 1, 1))[0] ?? null;
}

export function adviseModels(usage: ModelUsage[], now: Date, prices: ModelPrice[] = MODEL_PRICES, minSaving = 5): ModelAdvice[] {
  const out: ModelAdvice[] = [];
  for (const u of usage) {
    const p = findPrice(u.model, prices);
    const avgOut = u.requests > 0 ? u.outputTokens / u.requests : null;
    const hasTokens = u.inputTokens + u.outputTokens > 0;
    const listEstimate = priced(p) && hasTokens ? costAt(p, u.inputTokens, u.outputTokens) : null;
    const base = listEstimate ?? u.cost;
    const ending = p && p.status !== 'active'
      ? { on: p.endsOn, status: p.status as 'deprecated' | 'retired', daysLeft: p.endsOn ? Math.ceil((new Date(p.endsOn + 'T00:00:00Z').getTime() - now.getTime()) / 86_400_000) : null }
      : null;

    const options: SwitchOption[] = [];
    const add = (to: ModelPrice, kind: SwitchOption['kind'], reason: string) => {
      if (!priced(to) || to.status !== 'active' || to.id === p?.id || options.some((o) => o.to === to.id) || !hasTokens) return;
      const estimate = costAt(to, u.inputTokens, u.outputTokens);
      const saving = base - estimate;
      if (kind !== 'replacement' && (saving < minSaving || saving / Math.max(base, 0.01) < 0.15)) return;
      options.push({ to: to.id, provider: to.provider, tier: to.tier, estimate, saving, savingShare: base > 0 ? saving / base : 0, reason, kind, promoUntil: to.promo?.until ?? null });
    };

    if (p) {
      if (ending) {
        const r = liveReplacement(p, prices);
        if (r) add(r, 'replacement', `${providerName(p.provider)} ${ending.status === 'retired' ? 'has retired' : 'is retiring'} ${u.model}${p.replacement ? ` and names ${r.id} as its replacement` : `; ${r.id} is its current successor`}.`);
      }
      for (const s of SWITCHES) {
        if (findPrice(s.from, prices)?.id !== p.id) continue;
        const to = findPrice(s.to, prices);
        if (!to) continue;
        const smaller = TIER_RANK[to.tier] < TIER_RANK[p.tier];
        const fit = smaller && avgOut !== null ? (avgOut < 400 ? ` Your answers average ${Math.round(avgOut)} tokens, short enough that a smaller model often copes.` : ` Your answers average ${Math.round(avgOut)} tokens, so test it carefully on the longer ones.`) : '';
        add(to, 'same_provider', s.reason + fit);
      }
      // Another provider's model in the same tier, if it is clearly cheaper for this mix.
      const rival = prices
        .filter((x) => x.provider !== p.provider && x.tier === p.tier && x.status === 'active' && priced(x))
        .map((x) => ({ x, c: costAt(x as never, u.inputTokens, u.outputTokens) }))
        .sort((a, b) => a.c - b.c)[0];
      if (rival && rival.c < base * 0.6) {
        add(rival.x, 'other_provider', `${providerName(rival.x.provider)}'s ${rival.x.tier === 'small' ? 'small' : rival.x.tier === 'mid' ? 'mid-tier' : 'top'} model costs less for your mix of tokens. A new provider is a new supplier: review it on the Suppliers page, and sign a data processing agreement before personal information goes to it.`);
      }
    }
    options.sort((a, b) => (a.kind === 'replacement' ? -1 : b.kind === 'replacement' ? 1 : 0) || b.saving - a.saving);
    out.push({
      model: u.model, provider: u.provider, matched: p?.id ?? null, tier: p?.tier ?? null, cost: u.cost, listEstimate,
      avgOutputTokens: avgOut, ending, options: options.slice(0, 3),
    });
  }
  return out.sort((a, b) => (b.ending ? 1 : 0) - (a.ending ? 1 : 0) || (b.options[0]?.saving ?? 0) - (a.options[0]?.saving ?? 0));
}

/** The best saving per model, added up: at most one switch per model counts. */
export function totalSaving(advice: ModelAdvice[]): number {
  return advice.reduce((n, a) => n + Math.max(0, ...a.options.filter((o) => o.kind !== 'other_provider').map((o) => o.saving)), 0);
}
