/**
 * OpenAI and Anthropic usage, pulled with an organisation's own read-only
 * admin key — the opt-in "api_key" mode. The default "exporter" mode runs the
 * same mapping on the organisation's side (public/exporter/aic-usage-exporter.mjs)
 * and pushes the result to /api/usage, so AIC never sees the key.
 *
 * Both providers report daily buckets. AIC stores one row per provider, model
 * and day, which is what llm_usage_records' dedupe key expects, so pulling the
 * same day twice overwrites rather than double-counts.
 *
 * Environment (tests and staging only): OPENAI_API_URL, ANTHROPIC_API_URL.
 */

export type Provider = 'openai' | 'anthropic';
export const AI_PROVIDERS: Provider[] = ['openai', 'anthropic'];
export const PROVIDER_LABEL: Record<Provider, string> = { openai: 'OpenAI', anthropic: 'Anthropic' };

export type UsageRow = {
  provider: Provider;
  model: string;
  periodStart: Date;
  periodEnd: Date;
  requests: number | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
};

const OPENAI = () => (process.env.OPENAI_API_URL || 'https://api.openai.com').replace(/\/$/, '');
const ANTHROPIC = () => (process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com').replace(/\/$/, '');

export class ProviderError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const rowKey = (model: string, start: Date) => `${model}|${dayKey(start)}`;

// ── OpenAI ──────────────────────────────────────────────────────────────────

type OpenAIBucket<R> = { start_time: number; end_time: number; results: R[] };
type OpenAIPage<R> = { data: OpenAIBucket<R>[]; has_more?: boolean; next_page?: string | null };
type OpenAIUsage = { model?: string | null; input_tokens?: number; output_tokens?: number; num_model_requests?: number };
type OpenAICost = { amount?: { value?: number; currency?: string }; line_item?: string | null };

/** "gpt-4o-2024-08-06, input" → "gpt-4o-2024-08-06". */
export function modelFromLineItem(lineItem: string | null | undefined): string {
  if (!lineItem) return '(unattributed)';
  return lineItem.split(',')[0].trim() || '(unattributed)';
}

export function mapOpenAI(usage: OpenAIBucket<OpenAIUsage>[], costs: OpenAIBucket<OpenAICost>[]): UsageRow[] {
  const rows = new Map<string, UsageRow>();
  const get = (model: string, start: number, end: number) => {
    const s = new Date(start * 1000);
    const k = rowKey(model, s);
    if (!rows.has(k)) {
      rows.set(k, {
        provider: 'openai', model, periodStart: s, periodEnd: new Date(end * 1000),
        requests: 0, inputTokens: 0, outputTokens: 0, costUsd: null,
      });
    }
    return rows.get(k)!;
  };
  for (const b of usage) {
    for (const r of b.results) {
      const row = get(r.model || '(unattributed)', b.start_time, b.end_time);
      row.requests = (row.requests ?? 0) + (r.num_model_requests ?? 0);
      row.inputTokens += r.input_tokens ?? 0;
      row.outputTokens += r.output_tokens ?? 0;
    }
  }
  for (const b of costs) {
    for (const r of b.results) {
      if ((r.amount?.currency ?? 'usd').toLowerCase() !== 'usd') continue;
      const row = get(modelFromLineItem(r.line_item), b.start_time, b.end_time);
      row.costUsd = (row.costUsd ?? 0) + (r.amount?.value ?? 0);
    }
  }
  return [...rows.values()].filter((r) => r.inputTokens + r.outputTokens > 0 || (r.costUsd ?? 0) > 0);
}

async function openaiPages<R>(path: string, key: string, params: Record<string, string>): Promise<OpenAIBucket<R>[]> {
  const out: OpenAIBucket<R>[] = [];
  let page: string | null = null;
  for (let i = 0; i < 10; i++) {
    const qs = new URLSearchParams(params);
    if (page) qs.set('page', page);
    const res = await fetch(`${OPENAI()}${path}?${qs}`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new ProviderError(res.status, `OpenAI returned ${res.status}.`);
    const body = (await res.json()) as OpenAIPage<R>;
    out.push(...(body.data ?? []));
    if (!body.has_more || !body.next_page) break;
    page = body.next_page;
  }
  return out;
}

export async function pullOpenAI(key: string, days: number, now = Date.now()): Promise<UsageRow[]> {
  const start = String(Math.floor((now - days * 86_400_000) / 86_400_000) * 86_400);
  const base = { start_time: start, bucket_width: '1d', limit: '31' };
  const usage = await openaiPages<OpenAIUsage>('/v1/organization/usage/completions', key, { ...base, 'group_by': 'model' });
  const costs = await openaiPages<OpenAICost>('/v1/organization/costs', key, { ...base, 'group_by': 'line_item' });
  return mapOpenAI(usage, costs);
}

// ── Anthropic ───────────────────────────────────────────────────────────────

type AnthropicBucket<R> = { starting_at: string; ending_at: string; results: R[] };
type AnthropicPage<R> = { data: AnthropicBucket<R>[]; has_more?: boolean; next_page?: string | null };
type AnthropicUsage = {
  model?: string | null;
  uncached_input_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation?: { ephemeral_1h_input_tokens?: number; ephemeral_5m_input_tokens?: number } | null;
  output_tokens?: number;
};
type AnthropicCost = { amount?: string; currency?: string; model?: string | null };

/**
 * Anthropic's cost report gives `amount` as a decimal string in the lowest
 * unit of the currency (cents for USD), per its Admin API reference. If a
 * real export ever disagrees with the console total by a factor of 100, this
 * is the line to look at.
 */
export const ANTHROPIC_AMOUNT_DIVISOR = 100;

export function mapAnthropic(usage: AnthropicBucket<AnthropicUsage>[], costs: AnthropicBucket<AnthropicCost>[]): UsageRow[] {
  const rows = new Map<string, UsageRow>();
  const get = (model: string, start: string, end: string) => {
    const s = new Date(start);
    const k = rowKey(model, s);
    if (!rows.has(k)) {
      rows.set(k, {
        provider: 'anthropic', model, periodStart: s, periodEnd: new Date(end),
        requests: null, inputTokens: 0, outputTokens: 0, costUsd: null,
      });
    }
    return rows.get(k)!;
  };
  for (const b of usage) {
    for (const r of b.results) {
      const row = get(r.model || '(unattributed)', b.starting_at, b.ending_at);
      row.inputTokens +=
        (r.uncached_input_tokens ?? 0) +
        (r.cache_read_input_tokens ?? 0) +
        (r.cache_creation?.ephemeral_1h_input_tokens ?? 0) +
        (r.cache_creation?.ephemeral_5m_input_tokens ?? 0);
      row.outputTokens += r.output_tokens ?? 0;
    }
  }
  for (const b of costs) {
    for (const r of b.results) {
      if ((r.currency ?? 'USD').toUpperCase() !== 'USD') continue;
      const amount = Number(r.amount ?? 0);
      if (!Number.isFinite(amount)) continue;
      const row = get(r.model || '(unattributed)', b.starting_at, b.ending_at);
      row.costUsd = (row.costUsd ?? 0) + amount / ANTHROPIC_AMOUNT_DIVISOR;
    }
  }
  return [...rows.values()].filter((r) => r.inputTokens + r.outputTokens > 0 || (r.costUsd ?? 0) > 0);
}

async function anthropicPages<R>(path: string, key: string, params: [string, string][]): Promise<AnthropicBucket<R>[]> {
  const out: AnthropicBucket<R>[] = [];
  let page: string | null = null;
  for (let i = 0; i < 10; i++) {
    const qs = new URLSearchParams(params);
    if (page) qs.set('page', page);
    const res = await fetch(`${ANTHROPIC()}${path}?${qs}`, {
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new ProviderError(res.status, `Anthropic returned ${res.status}.`);
    const body = (await res.json()) as AnthropicPage<R>;
    out.push(...(body.data ?? []));
    if (!body.has_more || !body.next_page) break;
    page = body.next_page;
  }
  return out;
}

export async function pullAnthropic(key: string, days: number, now = Date.now()): Promise<UsageRow[]> {
  const startMs = Math.floor((now - days * 86_400_000) / 86_400_000) * 86_400_000;
  const endMs = Math.ceil(now / 86_400_000) * 86_400_000;
  const range: [string, string][] = [
    ['starting_at', new Date(startMs).toISOString()],
    ['ending_at', new Date(endMs).toISOString()],
    ['bucket_width', '1d'],
    ['limit', '31'],
  ];
  const usage = await anthropicPages<AnthropicUsage>('/v1/organizations/usage_report/messages', key, [...range, ['group_by[]', 'model']]);
  const costs = await anthropicPages<AnthropicCost>('/v1/organizations/cost_report', key, [
    ...range.filter(([k]) => k !== 'bucket_width'),
    ['group_by[]', 'description'],
  ]);
  return mapAnthropic(usage, costs);
}

export async function pullUsage(provider: Provider, key: string, days: number): Promise<UsageRow[]> {
  return provider === 'openai' ? pullOpenAI(key, days) : pullAnthropic(key, days);
}

/** Admin keys only: a normal project key cannot read organisation usage. */
export function keyShapeProblem(provider: Provider, key: string): string | null {
  const k = key.trim();
  if (provider === 'openai' && !k.startsWith('sk-admin-')) {
    return 'That is not an OpenAI admin key. Admin keys start with sk-admin- and are created under Organisation settings → Admin keys.';
  }
  if (provider === 'anthropic' && !k.startsWith('sk-ant-admin')) {
    return 'That is not an Anthropic Admin API key. Admin keys start with sk-ant-admin and are created in the Console under Settings → Admin keys.';
  }
  return null;
}

export const keyHint = (key: string) => `…${key.trim().slice(-4)}`;
