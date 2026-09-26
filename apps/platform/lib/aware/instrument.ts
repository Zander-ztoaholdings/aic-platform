/**
 * The AIC Aware question set, fetched from where it is published.
 *
 * aic-web owns the questions and the scoring (lib/aware-instrument.ts there,
 * served at /api/aware/instrument and /api/aware/score). The platform keeps no
 * second definition, for the same reason lib/standard.ts does not: a
 * certification body with two versions of its own questionnaire has none.
 *
 * The pinned snapshot is a capture of that published set, carrying the same
 * version hash, used only when every live source fails so that an organisation
 * mid-way through AIC Aware is not stopped by a network blip.
 */

import snapshot from './instrument-snapshot.json';
import { candidateUrls } from '../standard';

export interface AwareOption { text: string; value: number }
export interface AwareQuestion {
  id: string;
  category: string;
  text: string;
  rationale: string | null;
  requirements: string[];
  options: AwareOption[];
}
export interface AwareCategory {
  key: string;
  name: string;
  weight: number;
  purpose?: string;
  rights?: string[];
}
export interface AwareInstrument {
  version: string;
  questions: AwareQuestion[];
  categories: AwareCategory[];
}

const CACHE_TTL_MS = 10 * 60_000;
const FETCH_TIMEOUT_MS = 6_000;

let cache: { at: number; instrument: AwareInstrument } | null = null;
export let lastInstrumentSource: 'live' | 'snapshot' | null = null;

function isInstrument(x: unknown): x is AwareInstrument {
  const i = x as AwareInstrument;
  return !!i && typeof i.version === 'string' && Array.isArray(i.questions) && i.questions.length > 0
    && Array.isArray(i.categories);
}

export function pinnedInstrument(): AwareInstrument {
  const { version, questions, categories } = snapshot as unknown as AwareInstrument;
  return { version, questions, categories };
}

export async function fetchAwareInstrument(): Promise<AwareInstrument> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.instrument;

  const attempts: string[] = [];
  for (const base of candidateUrls()) {
    const url = `${base}/api/aware/instrument`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(`returned ${res.status}`);
      const data = await res.json();
      if (!isInstrument(data)) throw new Error('returned no questions');
      const instrument = { version: data.version, questions: data.questions, categories: data.categories };
      cache = { at: Date.now(), instrument };
      lastInstrumentSource = 'live';
      return instrument;
    } catch (error) {
      attempts.push(`${url} — ${(error as Error).message}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  const pinned = pinnedInstrument();
  console.error(
    `[AWARE] Live question set unavailable, using pinned snapshot v${pinned.version}. Tried:\n  ` +
    attempts.join('\n  ')
  );
  cache = { at: Date.now(), instrument: pinned };
  lastInstrumentSource = 'snapshot';
  return pinned;
}

/**
 * Keep only answers that are valid for this instrument: known question ids and
 * values that are one of that question's options. Used for autosave, where a
 * partial set is normal.
 */
export function sanitisePartialAnswers(
  answers: unknown,
  instrument: AwareInstrument
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return out;
  const byId = new Map(instrument.questions.map((q) => [q.id, q]));
  for (const [id, raw] of Object.entries(answers as Record<string, unknown>)) {
    const q = byId.get(id);
    if (!q || typeof raw !== 'number') continue;
    if (q.options.some((o) => o.value === raw)) out[id] = raw;
  }
  return out;
}

/** Problems that stop a submission. Empty means complete and valid. */
export function validateCompleteAnswers(
  answers: Record<string, unknown>,
  instrument: AwareInstrument
): string[] {
  const problems: string[] = [];
  const known = new Set(instrument.questions.map((q) => q.id));
  for (const q of instrument.questions) {
    const v = answers[q.id];
    if (v === undefined || v === null) problems.push(`${q.id}: unanswered`);
    else if (typeof v !== 'number' || !q.options.some((o) => o.value === v)) {
      problems.push(`${q.id}: not one of the offered answers`);
    }
  }
  for (const k of Object.keys(answers)) if (!known.has(k)) problems.push(`${k}: not in question set ${instrument.version}`);
  return problems;
}

export interface AwareScore {
  version: string;
  score: number;
  tier: string;
  indicatedDivision: number | null;
  indicatedDivisionName: string | null;
  applicableCount: number;
  gapCodes: string[];
  flagshipGapCodes: string[];
  gapsByRight: Record<string, string[]>;
}

/**
 * Score a complete answer set with the website's scorer. Returns null (never an
 * invented number) when it cannot be reached or disagrees on version; the
 * badge is issued on the declaration, and the result is recorded when available.
 */
export async function scoreWithPublisher(
  answers: Record<string, number>,
  version: string
): Promise<AwareScore | null> {
  for (const base of candidateUrls()) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(`${base}/api/aware/score`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as AwareScore;
      if (typeof data?.score !== 'number') continue;
      if (data.version !== version) {
        console.error(`[AWARE] Scorer answered v${data.version} for answers taken against v${version}; not recording.`);
        return null;
      }
      return data;
    } catch {
      // next candidate
    } finally {
      clearTimeout(timeout);
    }
  }
  return null;
}
