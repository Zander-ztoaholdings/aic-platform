/**
 * AIC's own calls to a language model.
 *
 * Used only where reading free text is the bottleneck: drafting a
 * questionnaire answer the rules cannot place, suggesting which common
 * controls a customer's own requirement maps to, and a first read of an
 * uploaded document. Every output is a suggestion a named person accepts or
 * corrects; nothing a model writes is ever treated as verified.
 *
 * This is AIC's account with the model provider (AIC_AI_API_KEY), not a
 * client's connected provider key. Client data sent here is a transfer to the
 * provider: it must be covered by the data processing agreement, and the
 * account should use the provider's zero-retention terms (docs/OPERATIONS.md).
 *
 * Without AIC_AI_API_KEY every caller falls back to the rule-based behaviour.
 *
 * Environment: AIC_AI_API_KEY, AIC_AI_MODEL (default below), AIC_AI_API_URL (tests).
 */

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } }
  | { type: 'image'; source: { type: 'base64'; media_type: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'; data: string } };

const DEFAULT_MODEL = 'claude-sonnet-4-5';

export const aiConfigured = () => !!process.env.AIC_AI_API_KEY;
export const aiModel = () => process.env.AIC_AI_MODEL || DEFAULT_MODEL;
const baseUrl = () => (process.env.AIC_AI_API_URL || 'https://api.anthropic.com').replace(/\/$/, '');

export class AiError extends Error {}

/** Pulls the first JSON object out of a model's reply, tolerating a code fence around it. */
export function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) throw new AiError('The model did not return JSON.');
  return JSON.parse(body.slice(start, end + 1)) as T;
}

/**
 * One request, one JSON object back. Throws AiError on anything unexpected;
 * callers catch it and fall back, so a model outage never blocks the user.
 */
export async function askJson<T>(opts: { system: string; content: ContentBlock[]; maxTokens?: number; timeoutMs?: number }): Promise<T> {
  const key = process.env.AIC_AI_API_KEY;
  if (!key) throw new AiError('AI is not configured.');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 30_000);
  try {
    const r = await fetch(`${baseUrl()}/v1/messages`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: aiModel(),
        max_tokens: opts.maxTokens ?? 1200,
        temperature: 0,
        system: opts.system,
        messages: [{ role: 'user', content: opts.content }],
      }),
    });
    if (!r.ok) throw new AiError(`Model request failed: ${r.status} ${(await r.text().catch(() => '')).slice(0, 200)}`);
    const j = (await r.json()) as { content?: { type: string; text?: string }[] };
    const text = (j.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('');
    return extractJson<T>(text);
  } catch (e) {
    if (e instanceof AiError) throw e;
    throw new AiError(e instanceof Error ? e.message : String(e));
  } finally {
    clearTimeout(timer);
  }
}

/** Runs tasks with at most `limit` in flight, keeping order. */
export async function pool<T, R>(items: T[], limit: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
}
