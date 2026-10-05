#!/usr/bin/env node
/* global process, fetch, console, URLSearchParams */
/**
 * AIC usage exporter — runs on YOUR side, with YOUR provider admin key.
 *
 * It reads your OpenAI and/or Anthropic organisation usage for the last few
 * days and sends daily totals per model to AIC. Your provider key never
 * leaves the machine this runs on; AIC only receives the totals below.
 *
 * What AIC receives, per provider, model and day:
 *   provider, model, day start/end, requests (OpenAI only), input tokens,
 *   output tokens, cost in USD, and — if you map them — the name of the AI
 *   system that usage belongs to.
 *
 * Requirements: Node 18 or newer. No packages to install.
 *
 * Environment:
 *   AIC_API_KEY          required. An aic_live_ key from AIC → API & access keys.
 *   OPENAI_ADMIN_KEY     optional. An OpenAI admin key (sk-admin-…).
 *   ANTHROPIC_ADMIN_KEY  optional. An Anthropic Admin API key (sk-ant-admin…).
 *   AIC_URL              optional. Defaults to https://app.aiccertified.cloud
 *   DAYS                 optional. How many days back to send (default 3, max 31).
 *   SYSTEM_MAP           optional. JSON mapping an OpenAI project id or an
 *                        Anthropic workspace id to the name of the system it
 *                        belongs to, exactly as declared in AIC, e.g.
 *                        {"proj_abc123": "Loan pre-screening", "wrkspc_01X": "Claims triage"}
 *                        When one model's usage on one day spans several
 *                        systems, it is sent unattributed rather than guessed.
 *   DRY_RUN=1            optional. Print what would be sent, send nothing.
 *
 * Run it once a day, e.g. as a GitHub Action (see the AIC Connected systems
 * page for a ready-made workflow) or a cron job.
 */

const env = process.env;
const AIC_URL = (env.AIC_URL || 'https://app.aiccertified.cloud').replace(/\/$/, '');
const DAYS = Math.min(Math.max(parseInt(env.DAYS || '3', 10) || 3, 1), 31);
const DAY = 86_400_000;
const OPENAI_URL = (env.OPENAI_API_URL || 'https://api.openai.com').replace(/\/$/, '');
const ANTHROPIC_URL = (env.ANTHROPIC_API_URL || 'https://api.anthropic.com').replace(/\/$/, '');
let SYSTEM_MAP = {};
try { SYSTEM_MAP = env.SYSTEM_MAP ? JSON.parse(env.SYSTEM_MAP) : {}; } catch { fail('SYSTEM_MAP is not valid JSON.'); }

function fail(msg) { console.error(`aic-usage-exporter: ${msg}`); process.exit(1); }

if (!env.AIC_API_KEY || !env.AIC_API_KEY.startsWith('aic_live_')) fail('AIC_API_KEY must be set to an aic_live_ key.');
if (!env.OPENAI_ADMIN_KEY && !env.ANTHROPIC_ADMIN_KEY) fail('Set OPENAI_ADMIN_KEY, ANTHROPIC_ADMIN_KEY, or both.');

const now = Date.now();
const startMs = Math.floor((now - DAYS * DAY) / DAY) * DAY;
const endMs = Math.ceil(now / DAY) * DAY;

/** Rows keyed by model and day, carrying the set of systems their usage came from. */
function collector(provider) {
  const rows = new Map();
  return {
    get(model, start, end) {
      model = model || '(unattributed)';
      const k = `${model}|${new Date(start).toISOString().slice(0, 10)}`;
      if (!rows.has(k)) rows.set(k, { provider, model, period_start: new Date(start).toISOString(), period_end: new Date(end).toISOString(), requests: provider === 'openai' ? 0 : null, input_tokens: 0, output_tokens: 0, cost_usd: null, systems: new Set() });
      return rows.get(k);
    },
    records() {
      return [...rows.values()]
        .filter((r) => r.input_tokens + r.output_tokens > 0 || (r.cost_usd ?? 0) > 0)
        .map(({ systems, ...r }) => ({ ...r, system_name: systems.size === 1 && !systems.has(null) ? [...systems][0] : null }));
    },
  };
}

async function pages(url, headers, params) {
  const out = [];
  let page = null;
  for (let i = 0; i < 20; i++) {
    const qs = new URLSearchParams(params);
    if (page) qs.set('page', page);
    const res = await fetch(`${url}?${qs}`, { headers });
    if (!res.ok) fail(`${url} returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const body = await res.json();
    out.push(...(body.data || []));
    if (!body.has_more || !body.next_page) break;
    page = body.next_page;
  }
  return out;
}

async function openai() {
  const h = { Authorization: `Bearer ${env.OPENAI_ADMIN_KEY}` };
  const base = [['start_time', String(startMs / 1000)], ['end_time', String(endMs / 1000)], ['bucket_width', '1d'], ['limit', '31']];
  const c = collector('openai');
  const usage = await pages(`${OPENAI_URL}/v1/organization/usage/completions`, h, [...base, ['group_by', 'model'], ['group_by', 'project_id']]);
  for (const b of usage) for (const r of b.results || []) {
    const row = c.get(r.model, b.start_time * 1000, b.end_time * 1000);
    row.requests += r.num_model_requests || 0;
    row.input_tokens += r.input_tokens || 0;
    row.output_tokens += r.output_tokens || 0;
    row.systems.add(SYSTEM_MAP[r.project_id] ?? null);
  }
  const costs = await pages(`${OPENAI_URL}/v1/organization/costs`, h, [...base, ['group_by', 'line_item']]);
  for (const b of costs) for (const r of b.results || []) {
    if ((r.amount?.currency || 'usd').toLowerCase() !== 'usd') continue;
    const model = (r.line_item || '').split(',')[0].trim() || '(unattributed)';
    const row = c.get(model, b.start_time * 1000, b.end_time * 1000);
    row.cost_usd = (row.cost_usd || 0) + (r.amount?.value || 0);
  }
  return c.records();
}

async function anthropic() {
  const h = { 'x-api-key': env.ANTHROPIC_ADMIN_KEY, 'anthropic-version': '2023-06-01' };
  const range = [['starting_at', new Date(startMs).toISOString()], ['ending_at', new Date(endMs).toISOString()], ['limit', '31']];
  const c = collector('anthropic');
  const usage = await pages(`${ANTHROPIC_URL}/v1/organizations/usage_report/messages`, h, [...range, ['bucket_width', '1d'], ['group_by[]', 'model'], ['group_by[]', 'workspace_id']]);
  for (const b of usage) for (const r of b.results || []) {
    const row = c.get(r.model, b.starting_at, b.ending_at);
    row.input_tokens += (r.uncached_input_tokens || 0) + (r.cache_read_input_tokens || 0) + (r.cache_creation?.ephemeral_1h_input_tokens || 0) + (r.cache_creation?.ephemeral_5m_input_tokens || 0);
    row.output_tokens += r.output_tokens || 0;
    row.systems.add(SYSTEM_MAP[r.workspace_id] ?? null);
  }
  const costs = await pages(`${ANTHROPIC_URL}/v1/organizations/cost_report`, h, [...range, ['group_by[]', 'description']]);
  for (const b of costs) for (const r of b.results || []) {
    if ((r.currency || 'USD').toUpperCase() !== 'USD') continue;
    const amount = Number(r.amount || 0);
    if (!Number.isFinite(amount)) continue;
    const row = c.get(r.model, b.starting_at, b.ending_at);
    // Anthropic reports cost in cents, as a decimal string.
    row.cost_usd = (row.cost_usd || 0) + amount / 100;
  }
  return c.records();
}

const records = [
  ...(env.OPENAI_ADMIN_KEY ? await openai() : []),
  ...(env.ANTHROPIC_ADMIN_KEY ? await anthropic() : []),
];

if (env.DRY_RUN) {
  console.log(JSON.stringify({ records }, null, 2));
  process.exit(0);
}
if (records.length === 0) {
  console.log('aic-usage-exporter: no usage in the period, nothing sent.');
  process.exit(0);
}

for (let i = 0; i < records.length; i += 500) {
  const res = await fetch(`${AIC_URL}/api/usage`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.AIC_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ records: records.slice(i, i + 500) }),
  });
  if (!res.ok) fail(`AIC returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
}
console.log(`aic-usage-exporter: sent ${records.length} daily usage line${records.length === 1 ? '' : 's'} to AIC.`);
