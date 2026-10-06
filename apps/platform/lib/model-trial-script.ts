/**
 * aic-model-trial.mjs, served by app/api/v1/model-trials/script.
 *
 * The client runs this on its own machine, with its own provider key, over a
 * file of its own sample requests. It tests a cheaper model against the one
 * in use today and sends AIC only the counts (lib/model-trials.ts), never a
 * prompt, an answer or a judge's reason.
 *
 * It must run on Node 18+ with no packages, so the median and aggregation
 * from lib/model-trials.ts are duplicated below. Keep them in step: the lib
 * copy is the tested one. The price table is built from lib/ai-prices.ts each
 * time the platform is built, so it never drifts from the spend page.
 *
 * Written with String.raw so the script's own backslashes survive; the script
 * body uses no backticks and no dollar-brace, apart from the one price table.
 */
import { MODEL_PRICES } from './ai-prices';

const PRICE_TABLE: [string, number, number][] = MODEL_PRICES
  .filter((p) => (p.provider === 'anthropic' || p.provider === 'openai') && p.inputPerM !== null && p.outputPerM !== null)
  .flatMap((p) => [p.id, ...p.aliases].map((name) => [name, p.inputPerM as number, p.outputPerM as number] as [string, number, number]));

export const MODEL_TRIAL_SCRIPT = String.raw`#!/usr/bin/env node
/* global process, fetch, console */
/**
 * AIC model trial: tests a cheaper AI model on YOUR requests, on YOUR machine.
 *
 * It runs each sample request through the model you use today and the
 * cheaper one, asks a judge model whether the cheaper answer is as good, and
 * prints the result here. Your requests, the answers and the judge's reasons
 * never leave this machine. With --send, AIC receives only the counts: how
 * many answers were as good, worse or could not be scored, the cost of the
 * run on each model, and the median response time of each.
 *
 * Requirements: Node 18 or newer. No packages to install.
 *
 * Usage:
 *   node aic-model-trial.mjs --file samples.jsonl --from claude-sonnet-4-5 --to claude-sonnet-5-5 \
 *     [--judge claude-sonnet-5-5] [--limit 50] [--concurrency 4] [--max-tokens 1024] [--send]
 *
 * samples.jsonl has one request per line:
 *   {"system": "You answer customer questions about loans.", "prompt": "Can I pay early?"}
 *   {"prompt": "Summarise this complaint: ...", "reference": "An answer you know is right"}
 * "system" and "reference" are optional. With a reference, the judge compares
 * both answers to it; without, it compares the cheaper answer to today's.
 *
 * Environment:
 *   ANTHROPIC_API_KEY   for claude models.
 *   OPENAI_API_KEY      for gpt and o-series models.
 *   AIC_API_KEY         only with --send. An aic_live_ key from AIC, API keys page.
 *   AIC_URL             optional. Defaults to https://app.aiccertified.cloud
 *   ANTHROPIC_BASE_URL, OPENAI_BASE_URL   optional, for a proxy or gateway.
 */
import { readFileSync } from 'node:fs';

const env = process.env;
const AIC_URL = (env.AIC_URL || 'https://app.aiccertified.cloud').replace(/\/$/, '');
const ANTHROPIC_URL = (env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '');
const OPENAI_URL = (env.OPENAI_BASE_URL || 'https://api.openai.com').replace(/\/$/, '');

function fail(msg) { console.error('aic-model-trial: ' + msg); process.exit(1); }

// ── Arguments ───────────────────────────────────────────────────────────────
const args = { limit: '100', concurrency: '4', 'max-tokens': '1024' };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--send') { args.send = true; continue; }
  if (a === '--help' || a === '-h') { args.help = true; continue; }
  if (!a.startsWith('--')) fail('Unexpected argument: ' + a);
  const v = argv[i + 1];
  if (v === undefined || v.startsWith('--')) fail(a + ' needs a value.');
  args[a.slice(2)] = v;
  i++;
}
if (args.help || !args.file || !args.from || !args.to) {
  console.log('Usage: node aic-model-trial.mjs --file samples.jsonl --from <model in use> --to <cheaper model> [--judge <model>] [--limit 100] [--concurrency 4] [--max-tokens 1024] [--send]');
  process.exit(args.help ? 0 : 1);
}
const FROM = args.from.trim();
const TO = args.to.trim();
const JUDGE = (args.judge || FROM).trim();
const LIMIT = Math.min(Math.max(parseInt(args.limit, 10) || 100, 1), 10000);
const CONCURRENCY = Math.min(Math.max(parseInt(args.concurrency, 10) || 4, 1), 16);
const MAX_TOKENS = Math.min(Math.max(parseInt(args['max-tokens'], 10) || 1024, 16), 32000);
if (FROM.toLowerCase() === TO.toLowerCase()) fail('--from and --to must be different models.');
if (FROM.length > 120 || TO.length > 120) fail('Model names can be at most 120 characters.');

const providerOf = (model) => /^claude/i.test(model) ? 'anthropic' : /^(gpt|o)/i.test(model) ? 'openai' : null;
for (const m of [FROM, TO, JUDGE]) {
  const p = providerOf(m);
  if (!p) fail(m + ': this script calls Anthropic (claude models) and OpenAI (gpt and o-series models) only.');
  if (p === 'anthropic' && !env.ANTHROPIC_API_KEY) fail('Set ANTHROPIC_API_KEY to test ' + m + '.');
  if (p === 'openai' && !env.OPENAI_API_KEY) fail('Set OPENAI_API_KEY to test ' + m + '.');
}
if (args.send && !(env.AIC_API_KEY || '').startsWith('aic_live_')) fail('--send needs AIC_API_KEY set to an aic_live_ key from AIC.');

// ── Samples ─────────────────────────────────────────────────────────────────
let raw;
try { raw = readFileSync(args.file, 'utf8'); } catch (e) { fail('Could not read ' + args.file + ': ' + e.message); }
const samples = [];
raw.split(/\r?\n/).forEach((line, i) => {
  if (!line.trim() || samples.length >= LIMIT) return;
  let s;
  try { s = JSON.parse(line); } catch { fail('Line ' + (i + 1) + ' is not valid JSON.'); }
  if (!s || typeof s.prompt !== 'string' || !s.prompt.trim()) fail('Line ' + (i + 1) + ' needs a "prompt" string.');
  if (s.system !== undefined && typeof s.system !== 'string') fail('Line ' + (i + 1) + ': "system" must be a string.');
  if (s.reference !== undefined && typeof s.reference !== 'string') fail('Line ' + (i + 1) + ': "reference" must be a string.');
  samples.push({ line: i + 1, system: s.system || '', prompt: s.prompt, reference: s.reference && s.reference.trim() ? s.reference : null });
});
if (samples.length === 0) fail(args.file + ' has no requests in it.');

// ── Prices (from AIC's price list, US dollars per million tokens) ───────────
const PRICES = ${JSON.stringify(PRICE_TABLE)};
const stripDate = (id) => id.toLowerCase().replace(/-(\d{4}-\d{2}-\d{2}|\d{8})$/, '');
function priceOf(model) {
  const m = model.trim().toLowerCase();
  const hit = PRICES.find((p) => p[0] === m)
    || PRICES.find((p) => stripDate(p[0]) === stripDate(m))
    || PRICES.filter((p) => m.startsWith(p[0] + '-')).sort((a, b) => b[0].length - a[0].length)[0];
  return hit ? { inputPerM: hit[1], outputPerM: hit[2] } : null;
}
const costAt = (p, inputTokens, outputTokens) => (inputTokens / 1e6) * p.inputPerM + (outputTokens / 1e6) * p.outputPerM;

// ── Scoring (kept in step with lib/model-trials.ts) ─────────────────────────
function median(values) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return Math.round(v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2);
}
function aggregateTrial(fromModel, toModel, results, price) {
  const both = results.filter((r) => r.from && r.to);
  const sum = (side, model) => {
    const p = price(model);
    if (!p || both.length === 0) return null;
    const c = both.reduce((n, r) => n + costAt(p, r[side].inputTokens, r[side].outputTokens), 0);
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
    fromLatencyMs: median(both.map((r) => r.from.ms)),
    toLatencyMs: median(both.map((r) => r.to.ms)),
  };
}

// ── Providers ───────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function post(url, headers, body) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, headers), body: JSON.stringify(body) });
    if ((res.status === 429 || res.status >= 500) && attempt < 3) { await sleep(1000 * 2 ** attempt); continue; }
    const text = await res.text();
    if (!res.ok) throw new Error(res.status + ' ' + text.slice(0, 200));
    return JSON.parse(text);
  }
}

/** One answer from a model: its text, how long it took and the tokens it used. */
async function ask(model, system, prompt, maxTokens) {
  const started = Date.now();
  if (providerOf(model) === 'anthropic') {
    const body = { model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] };
    if (system) body.system = system;
    const j = await post(ANTHROPIC_URL + '/v1/messages', { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }, body);
    const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
    return { text, ms: Date.now() - started, inputTokens: (j.usage && j.usage.input_tokens) || 0, outputTokens: (j.usage && j.usage.output_tokens) || 0 };
  }
  const messages = system ? [{ role: 'system', content: system }, { role: 'user', content: prompt }] : [{ role: 'user', content: prompt }];
  const j = await post(OPENAI_URL + '/v1/chat/completions', { authorization: 'Bearer ' + env.OPENAI_API_KEY }, { model, messages, max_completion_tokens: maxTokens });
  const text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
  return { text, ms: Date.now() - started, inputTokens: (j.usage && j.usage.prompt_tokens) || 0, outputTokens: (j.usage && j.usage.completion_tokens) || 0 };
}

const JUDGE_SYSTEM = [
  'You compare two answers to the same request and decide whether answer B is as good as answer A for the person who asked.',
  'Judge correctness, completeness and whether the instructions were followed. Differences in wording, length or style do not count unless they make the answer less useful.',
  'When a reference answer is given, treat it as correct: compare each answer to the reference, and B is as good when it is at least as close to the reference as A.',
  'Reply with JSON only, no other text: {"verdict":"as_good"|"worse","reason":"one short line"}',
].join('\n');

async function judge(sample, a, b) {
  const parts = [];
  if (sample.system) parts.push('<instructions given to the model>\n' + sample.system + '\n</instructions given to the model>');
  parts.push('<request>\n' + sample.prompt + '\n</request>');
  if (sample.reference) parts.push('<reference answer>\n' + sample.reference + '\n</reference answer>');
  parts.push('<answer A>\n' + a + '\n</answer A>');
  parts.push('<answer B>\n' + b + '\n</answer B>');
  const r = await ask(JUDGE, JUDGE_SYSTEM, parts.join('\n\n'), 300);
  const m = r.text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('the judge did not reply with JSON');
  const j = JSON.parse(m[0]);
  if (j.verdict !== 'as_good' && j.verdict !== 'worse') throw new Error('the judge gave no verdict');
  return { verdict: j.verdict, reason: String(j.reason || '').replace(/\s+/g, ' ').slice(0, 200) };
}

async function runSample(s) {
  const r = { line: s.line, verdict: 'failed', hasReference: !!s.reference, from: null, to: null, reason: '' };
  try {
    const [a, b] = await Promise.all([ask(FROM, s.system, s.prompt, MAX_TOKENS), ask(TO, s.system, s.prompt, MAX_TOKENS)]);
    r.from = { ms: a.ms, inputTokens: a.inputTokens, outputTokens: a.outputTokens };
    r.to = { ms: b.ms, inputTokens: b.inputTokens, outputTokens: b.outputTokens };
    if (!a.text.trim() || !b.text.trim()) throw new Error((a.text.trim() ? TO : FROM) + ' gave an empty answer');
    const j = await judge(s, a.text, b.text);
    r.verdict = j.verdict;
    r.reason = j.reason;
  } catch (e) {
    r.verdict = 'failed';
    r.reason = 'Could not score: ' + (e && e.message ? e.message : String(e));
  }
  return r;
}

// ── Run ─────────────────────────────────────────────────────────────────────
console.log('Testing ' + TO + ' against ' + FROM + ' on ' + samples.length + ' request' + (samples.length === 1 ? '' : 's') + ', judged by ' + JUDGE + '.');
console.log('Everything below stays on this machine.\n');
const results = new Array(samples.length);
let next = 0;
let done = 0;
async function worker() {
  while (next < samples.length) {
    const i = next++;
    results[i] = await runSample(samples[i]);
    done++;
    if (process.stderr.isTTY) process.stderr.write('\r' + done + ' of ' + samples.length + ' done');
  }
}
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, samples.length) }, worker));
if (process.stderr.isTTY) process.stderr.write('\n');

const LABEL = { as_good: 'as good', worse: 'worse  ', failed: 'failed ' };
const secs = (ms) => (ms / 1000).toFixed(1) + 's';
for (const r of results) {
  const times = r.from && r.to ? secs(r.from.ms) + ' vs ' + secs(r.to.ms) : '';
  console.log('line ' + String(r.line).padEnd(5) + LABEL[r.verdict] + '  ' + times.padEnd(14) + r.reason);
}

const trial = aggregateTrial(FROM, TO, results, priceOf);
const share = trial.asGood / trial.samples;
const verdict = share >= 0.9 && trial.failed / trial.samples <= 0.05 ? 'Passed' : share >= 0.7 ? 'Mixed' : 'Failed';
const usd = (n) => n === null ? 'not in the price list' : '$' + n.toFixed(4);
console.log('\n' + verdict + ': ' + trial.asGood + ' of ' + trial.samples + ' answers were judged as good as ' + FROM + "'s" + (trial.failed ? ', and ' + trial.failed + ' could not be scored.' : '.'));
console.log('Cost of this run: ' + FROM + ' ' + usd(trial.fromCostUsd) + ', ' + TO + ' ' + usd(trial.toCostUsd) + ' (list prices).');
if (trial.fromLatencyMs !== null) console.log('Median response time: ' + FROM + ' ' + secs(trial.fromLatencyMs) + ', ' + TO + ' ' + secs(trial.toLatencyMs) + '.');
if (trial.worse > 0) console.log('Read the "worse" lines above before you switch: they show where the cheaper model falls short.');

if (!args.send) {
  console.log('\nNothing was sent to AIC. Run again with --send to add this score to your AI spend page.');
  process.exit(0);
}

console.log('\nThis is everything that will be sent to AIC (' + AIC_URL + '):');
console.log(JSON.stringify(trial, null, 2));
try {
  const res = await fetch(AIC_URL + '/api/v1/model-trials', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + env.AIC_API_KEY },
    body: JSON.stringify(trial),
  });
  const text = await res.text();
  if (!res.ok) fail('AIC refused the result (' + res.status + '): ' + text.slice(0, 300));
  console.log('Sent. The score now shows on your AI spend page.');
} catch (e) {
  fail('Could not reach AIC: ' + e.message);
}
`;
