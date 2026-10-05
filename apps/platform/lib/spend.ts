/**
 * AI spend, from the usage AIC already collects (llm_usage_records: one row
 * per provider, model and day, from a connected key or the exporter).
 *
 * Everything here is arithmetic on recorded figures. Savings flags are
 * suggestions to test, never a promise of a saving: AIC does not see prompts
 * or outputs, so it cannot know whether a smaller model would do the job.
 *
 * Pure: tested in __tests__/lib/spend.test.ts.
 */

export interface UsageRow {
  provider: string;
  model: string | null;
  systemName: string | null;
  periodStart: Date | string;
  requests: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | string | null;
}

export interface Slice { key: string; label: string; cost: number; requests: number; share: number }
export interface Flag { kind: 'budget' | 'spike' | 'premium_short' | 'unattributed' | 'no_cost'; severity: 'warn' | 'info'; title: string; detail: string }

const DAY = 86_400_000;
const num = (v: unknown) => (v === null || v === undefined || v === '' ? 0 : Number(v) || 0);
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** Models priced well above their provider's small tier. Matched by prefix, case-insensitive. */
export const PREMIUM_MODELS = ['gpt-4o', 'gpt-4.1', 'gpt-4-', 'gpt-5', 'o1', 'o3', 'claude-opus', 'claude-sonnet', 'claude-3-opus', 'claude-3-5-sonnet', 'claude-3-7-sonnet'];
const SMALL_MARKERS = ['mini', 'nano', 'haiku', 'flash', 'small'];
export function isPremium(model: string) {
  const m = model.toLowerCase();
  if (SMALL_MARKERS.some((s) => m.includes(s))) return false;
  return PREMIUM_MODELS.some((p) => m.startsWith(p));
}

function slices(rows: UsageRow[], key: (r: UsageRow) => string, label: (k: string) => string, total: number): Slice[] {
  const map = new Map<string, { cost: number; requests: number }>();
  for (const r of rows) {
    const k = key(r);
    const v = map.get(k) ?? { cost: 0, requests: 0 };
    v.cost += num(r.costUsd);
    v.requests += num(r.requests);
    map.set(k, v);
  }
  return [...map.entries()]
    .map(([k, v]) => ({ key: k, label: label(k), cost: v.cost, requests: v.requests, share: total > 0 ? v.cost / total : 0 }))
    .sort((a, b) => b.cost - a.cost);
}

export function summariseSpend(rows: UsageRow[], now: Date, budgetUsd: number | null) {
  const nowMs = now.getTime();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const dayOfMonth = now.getUTCDate();
  const t = (r: UsageRow) => new Date(r.periodStart).getTime();

  const last30 = rows.filter((r) => t(r) >= nowMs - 30 * DAY);
  const mtdRows = rows.filter((r) => t(r) >= startOfMonth.getTime());
  const lastMonthRows = rows.filter((r) => t(r) >= startOfLastMonth.getTime() && t(r) < startOfMonth.getTime());
  const sum = (rs: UsageRow[]) => rs.reduce((n, r) => n + num(r.costUsd), 0);

  const total30 = sum(last30);
  const monthToDate = sum(mtdRows);
  const lastMonth = sum(lastMonthRows);
  // Projection from the days with data so far; usage arrives a day late, so
  // divide by completed days rather than today's date.
  const completedDays = Math.max(1, dayOfMonth - 1);
  const projected = dayOfMonth <= 1 ? null : (monthToDate / completedDays) * daysInMonth;

  const daily: { day: string; cost: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = dayKey(new Date(nowMs - i * DAY));
    daily.push({ day: d, cost: 0 });
  }
  const idx = new Map(daily.map((d, i) => [d.day, i]));
  for (const r of last30) {
    const i = idx.get(dayKey(new Date(r.periodStart)));
    if (i !== undefined) daily[i].cost += num(r.costUsd);
  }

  const byProvider = slices(last30, (r) => r.provider, (k) => (k === 'openai' ? 'OpenAI' : k === 'anthropic' ? 'Anthropic' : k), total30);
  const byModel = slices(last30, (r) => r.model ?? '(model not reported)', (k) => k, total30);
  const bySystem = slices(last30, (r) => r.systemName ?? '', (k) => k || 'Not linked to a declared system', total30);

  const flags: Flag[] = [];
  if (budgetUsd && budgetUsd > 0) {
    if (monthToDate > budgetUsd) {
      flags.push({ kind: 'budget', severity: 'warn', title: 'Over this month’s AI budget', detail: `$${monthToDate.toFixed(2)} spent so far against a budget of $${budgetUsd.toFixed(2)}.` });
    } else if (projected !== null && projected > budgetUsd) {
      flags.push({ kind: 'budget', severity: 'warn', title: 'On course to pass this month’s AI budget', detail: `At the current rate the month ends near $${projected.toFixed(2)}, against a budget of $${budgetUsd.toFixed(2)}.` });
    }
  }

  const last7 = daily.slice(-7).reduce((n, d) => n + d.cost, 0) / 7;
  const prior21 = daily.slice(0, 23).slice(-21).reduce((n, d) => n + d.cost, 0) / 21;
  if (prior21 > 0.5 && last7 > prior21 * 1.5) {
    flags.push({ kind: 'spike', severity: 'warn', title: 'Spending is rising', detail: `The last 7 days averaged $${last7.toFixed(2)} a day, against $${prior21.toFixed(2)} a day over the three weeks before.` });
  }

  for (const m of byModel) {
    if (!isPremium(m.key) || m.cost < 20) continue;
    const rs = last30.filter((r) => (r.model ?? '') === m.key);
    const reqs = rs.reduce((n, r) => n + num(r.requests), 0);
    const out = rs.reduce((n, r) => n + num(r.outputTokens), 0);
    if (reqs < 100) continue;
    const avgOut = out / reqs;
    if (avgOut < 400) {
      flags.push({
        kind: 'premium_short', severity: 'info',
        title: `${m.key} mostly gives short answers`,
        detail: `$${m.cost.toFixed(2)} in 30 days across ${reqs.toLocaleString('en-ZA')} requests, averaging ${Math.round(avgOut)} output tokens. Short, routine requests often run well on a smaller model from the same provider. Test one on a sample of real requests before switching; AIC cannot see your prompts, so it cannot judge quality for you.`,
      });
    }
  }

  const unattributed = bySystem.find((s) => s.key === '');
  if (unattributed && total30 > 0 && unattributed.share >= 0.2) {
    flags.push({ kind: 'unattributed', severity: 'info', title: `${Math.round(unattributed.share * 100)}% of spend is not linked to a declared system`, detail: 'Link each model to the AI system it serves on the Automated checks page, or send a system name from the exporter, so cost and accountability line up.' });
  }

  if (last30.some((r) => r.costUsd === null || r.costUsd === undefined || r.costUsd === '')) {
    flags.push({ kind: 'no_cost', severity: 'info', title: 'Some usage arrived without a cost', detail: 'The provider reported tokens but no price for some models, so the totals here are lower than the real bill.' });
  }

  return {
    currency: 'USD' as const,
    last30: total30,
    monthToDate,
    lastMonth,
    projected,
    budget: budgetUsd,
    daily,
    byProvider,
    byModel,
    bySystem,
    flags,
    hasData: rows.length > 0,
  };
}
