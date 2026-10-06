/**
 * Calls the agent's model with its tools, using the organisation's own key.
 * Anthropic Messages and OpenAI Chat Completions are normalised to one shape
 * so the runtime does not care which provider it talks to.
 */
import type { AgentProvider } from './config';

export type ToolSpec = { name: string; description: string; schema: Record<string, unknown> };

/** The conversation as the runtime keeps it, provider-neutral. */
export type Msg =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; calls: ToolCall[] }
  | { role: 'tool'; results: { id: string; name: string; content: string; isError?: boolean }[] };

export type ToolCall = { id: string; name: string; input: Record<string, unknown> };

export type ModelReply = { text: string; calls: ToolCall[]; inputTokens: number; outputTokens: number; stop: 'tool_use' | 'end' | 'max_tokens' };

export class ModelError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const anthropicUrl = () => (process.env.AIC_AGENT_ANTHROPIC_URL || 'https://api.anthropic.com').replace(/\/+$/, '');
const openaiUrl = () => (process.env.AIC_AGENT_OPENAI_URL || 'https://api.openai.com').replace(/\/+$/, '');

function toAnthropic(msgs: Msg[]) {
  return msgs.map((m) => {
    if (m.role === 'user') return { role: 'user', content: m.text };
    if (m.role === 'assistant') {
      const content: unknown[] = [];
      if (m.text) content.push({ type: 'text', text: m.text });
      for (const c of m.calls) content.push({ type: 'tool_use', id: c.id, name: c.name, input: c.input });
      return { role: 'assistant', content };
    }
    return { role: 'user', content: m.results.map((r) => ({ type: 'tool_result', tool_use_id: r.id, content: r.content, ...(r.isError ? { is_error: true } : {}) })) };
  });
}

function toOpenAI(system: string, msgs: Msg[]) {
  const out: unknown[] = [{ role: 'system', content: system }];
  for (const m of msgs) {
    if (m.role === 'user') out.push({ role: 'user', content: m.text });
    else if (m.role === 'assistant') {
      out.push({
        role: 'assistant', content: m.text || null,
        ...(m.calls.length ? { tool_calls: m.calls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.input) } })) } : {}),
      });
    } else for (const r of m.results) out.push({ role: 'tool', tool_call_id: r.id, content: r.content });
  }
  return out;
}

async function post(url: string, headers: Record<string, string>, body: unknown, timeoutMs: number): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    throw new ModelError(502, (e as Error).name === 'TimeoutError' ? 'The model took too long to answer.' : 'Could not reach the model provider.');
  }
  const text = await res.text();
  let j: Record<string, unknown> = {};
  try { j = JSON.parse(text); } catch { /* not JSON */ }
  if (!res.ok) {
    const err = (j.error as { message?: string } | undefined)?.message;
    const msg = res.status === 401 ? 'The provider refused the model key.' : res.status === 429 ? 'The provider is rate limiting this key.' : err ? `The provider said: ${String(err).slice(0, 300)}` : `The provider answered ${res.status}.`;
    throw new ModelError(res.status, msg);
  }
  return j;
}

const parseArgs = (s: unknown): Record<string, unknown> => {
  if (s && typeof s === 'object') return s as Record<string, unknown>;
  try { const v = JSON.parse(String(s ?? '{}')); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
};

export async function callModel(input: {
  provider: AgentProvider; model: string; apiKey: string; system: string; messages: Msg[]; tools: ToolSpec[]; maxTokens: number; timeoutMs?: number;
}): Promise<ModelReply> {
  const timeout = input.timeoutMs ?? 90_000;
  if (input.provider === 'anthropic') {
    const j = await post(`${anthropicUrl()}/v1/messages`, { 'x-api-key': input.apiKey, 'anthropic-version': '2023-06-01' }, {
      model: input.model, max_tokens: input.maxTokens, system: input.system, messages: toAnthropic(input.messages),
      ...(input.tools.length ? { tools: input.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.schema })) } : {}),
    }, timeout);
    const blocks = (j.content as { type: string; text?: string; id?: string; name?: string; input?: unknown }[] | undefined) ?? [];
    const usage = (j.usage as { input_tokens?: number; output_tokens?: number } | undefined) ?? {};
    const calls = blocks.filter((b) => b.type === 'tool_use').map((b) => ({ id: String(b.id), name: String(b.name), input: parseArgs(b.input) }));
    return {
      text: blocks.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('\n').trim(),
      calls, inputTokens: Number(usage.input_tokens ?? 0), outputTokens: Number(usage.output_tokens ?? 0),
      stop: calls.length ? 'tool_use' : j.stop_reason === 'max_tokens' ? 'max_tokens' : 'end',
    };
  }
  const j = await post(`${openaiUrl()}/v1/chat/completions`, { authorization: `Bearer ${input.apiKey}` }, {
    model: input.model, max_completion_tokens: input.maxTokens, messages: toOpenAI(input.system, input.messages),
    ...(input.tools.length ? { tools: input.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.schema } })) } : {}),
  }, timeout);
  const choice = ((j.choices as { message?: { content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] }; finish_reason?: string }[] | undefined) ?? [])[0];
  const usage = (j.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined) ?? {};
  const calls = (choice?.message?.tool_calls ?? []).map((c) => ({ id: c.id, name: c.function.name, input: parseArgs(c.function.arguments) }));
  return {
    text: (choice?.message?.content ?? '').trim(), calls,
    inputTokens: Number(usage.prompt_tokens ?? 0), outputTokens: Number(usage.completion_tokens ?? 0),
    stop: calls.length ? 'tool_use' : choice?.finish_reason === 'length' ? 'max_tokens' : 'end',
  };
}
