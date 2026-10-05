/**
 * Suggests which common controls each requirement of an organisation's own
 * framework maps to. The model reads the requirement's wording against the
 * list of common controls; the keyword matcher is the fallback. Either way the
 * person sees the suggestion and confirms or corrects it before saving.
 */
import { COMMON_CONTROLS, COMMON_BY_KEY } from '../common-controls';
import { suggestControls } from '../frameworks/custom';
import { aiConfigured, askJson, pool } from './claude';

const SYSTEM = `You map the requirements of a security, privacy or AI governance framework to a fixed list of common controls.

For each requirement, choose the common controls (0 to 3, best first) whose evidence would usually support it. Choose none when nothing in the list fits, for example physical security or HR screening; never stretch a control to fit.

Use only the keys given. Reply with JSON only: {"map": {"<requirement id>": ["<key>", ...], ...}}`;

const CATALOGUE = COMMON_CONTROLS.map((c) => `${c.key}: ${c.title}. ${c.evidence}`).join('\n');

export async function suggestMappings(reqs: { id: string; title: string }[]): Promise<{ map: Record<string, string[]>; source: 'ai' | 'keywords' }> {
  const keywords = Object.fromEntries(reqs.map((r) => [r.id, suggestControls(r.title)]));
  if (!aiConfigured() || reqs.length === 0) return { map: keywords, source: 'keywords' };
  const chunks: { id: string; title: string }[][] = [];
  for (let i = 0; i < reqs.length; i += 50) chunks.push(reqs.slice(i, i + 50));
  try {
    const parts = await pool(chunks, 3, (chunk) => askJson<{ map?: Record<string, unknown> }>({
      system: SYSTEM,
      content: [{ type: 'text', text: `Common controls:\n${CATALOGUE}\n\nRequirements:\n${chunk.map((r) => `[${r.id}] ${r.title}`).join('\n')}` }],
      maxTokens: 2500,
      timeoutMs: 45_000,
    }));
    const map: Record<string, string[]> = {};
    for (const r of reqs) {
      const got = parts.map((p) => p.map?.[r.id]).find((v) => Array.isArray(v)) as unknown[] | undefined;
      map[r.id] = got ? [...new Set(got.filter((k): k is string => typeof k === 'string' && !!COMMON_BY_KEY[k]))].slice(0, 3) : keywords[r.id];
    }
    return { map, source: 'ai' };
  } catch (e) {
    console.error('[MAP_REQUIREMENTS_AI]', e instanceof Error ? e.message : e);
    return { map: keywords, source: 'keywords' };
  }
}
