/**
 * AIC's own markets: where the company sells today and where it is going
 * next. Each market sits at one stage, has an owner and a next step, and every
 * move between stages is recorded with a reason in hq_jurisdiction_events.
 *
 * Nothing here scores or estimates a market. The figures the board shows are
 * counts of what people entered, nothing more.
 */

export const STAGES = ['watching', 'mapped', 'preparing', 'entering', 'live', 'paused'] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  watching: 'Watching',
  mapped: 'Mapped',
  preparing: 'Preparing',
  entering: 'Entering',
  live: 'Live',
  paused: 'Paused',
};

export const STAGE_MEANING: Record<Stage, string> = {
  watching: 'Law tracked, no work started.',
  mapped: 'The law is mapped to the AIC standard.',
  preparing: 'Partner, regulator contact or pricing in progress.',
  entering: 'First clients or pilots.',
  live: 'Selling and certifying.',
  paused: 'Stopped, with the reason in the history.',
};

export const isStage = (v: unknown): v is Stage => typeof v === 'string' && (STAGES as readonly string[]).includes(v);

/** A stage move needs a reason a reader can act on, not "ok". */
export const MIN_NOTE = 10;

export type MarketFields = {
  code: string;
  name: string;
  region: string | null;
  law: string | null;
  automatedDecisionSection: string | null;
  regulator: string | null;
  ownerName: string | null;
  nextStep: string | null;
  nextStepDue: string | null;
  notes: string | null;
};

const LIMITS: Record<keyof MarketFields, number> = {
  code: 8, name: 120, region: 60, law: 2000, automatedDecisionSection: 120, regulator: 200,
  ownerName: 200, nextStep: 2000, nextStepDue: 10, notes: 8000,
};

const EDITABLE = Object.keys(LIMITS) as (keyof MarketFields)[];

const str = (v: unknown, n: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null);

function validDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** Validates one field; returns the cleaned value or an error. */
function field(k: keyof MarketFields, v: unknown): { error: string } | { value: string | null } {
  if (k === 'code') {
    const c = typeof v === 'string' ? v.trim().toUpperCase() : '';
    if (!/^[A-Z]{2,3}(-[A-Z0-9]{1,4})?$/.test(c)) return { error: 'Give the country code, for example ZA or BW.' };
    return { value: c };
  }
  if (k === 'name') {
    const n = typeof v === 'string' ? v.trim() : '';
    if (n.length < 2) return { error: 'Give the market a name.' };
    return { value: n.slice(0, LIMITS.name) };
  }
  if (k === 'nextStepDue') {
    if (v == null || v === '') return { value: null };
    if (typeof v !== 'string' || !validDate(v)) return { error: 'The due date must be a real date.' };
    return { value: v };
  }
  if (v != null && typeof v !== 'string') return { error: 'Each field must be text.' };
  return { value: str(v, LIMITS[k]) };
}

export type MarketCreate = MarketFields & { stage: Stage; note: string | null };

/** Validates a new market from a request body. */
export function validateCreate(b: unknown): { error: string } | { value: MarketCreate } {
  const o = (b ?? {}) as Record<string, unknown>;
  const out: Partial<MarketFields> = {};
  for (const k of EDITABLE) {
    const r = field(k, o[k]);
    if ('error' in r) return r;
    (out as Record<string, string | null>)[k] = r.value;
  }
  let stage: Stage = 'watching';
  if (o.stage != null && o.stage !== '') {
    if (!isStage(o.stage)) return { error: 'Choose one of the stages.' };
    stage = o.stage;
  }
  return { value: { ...(out as MarketFields), stage, note: str(o.note, 4000) } };
}

export type MarketUpdate = { fields: Partial<MarketFields>; stage: Stage | null; note: string | null };

/**
 * Validates an edit. Only fields present in the body change. Moving stage
 * (to a stage other than the current one) needs a note of at least MIN_NOTE
 * characters.
 */
export function validateUpdate(b: unknown, currentStage: string): { error: string } | { value: MarketUpdate } {
  const o = (b ?? {}) as Record<string, unknown>;
  const fields: Partial<MarketFields> = {};
  for (const k of EDITABLE) {
    if (!(k in o)) continue;
    const r = field(k, o[k]);
    if ('error' in r) return r;
    (fields as Record<string, string | null>)[k] = r.value;
  }
  let stage: Stage | null = null;
  if (o.stage != null && o.stage !== '') {
    if (!isStage(o.stage)) return { error: 'Choose one of the stages.' };
    if (o.stage !== currentStage) stage = o.stage;
  }
  const note = str(o.note, 4000);
  if (stage && (!note || note.length < MIN_NOTE)) {
    return { error: `Say why it is moving to ${STAGE_LABEL[stage].toLowerCase()}, in at least ${MIN_NOTE} characters.` };
  }
  if (!stage && Object.keys(fields).length === 0 && !note) return { error: 'Nothing to change.' };
  return { value: { fields, stage, note } };
}

/** A delete needs a reason, and only a market nobody has worked on may go. */
export function validateDelete(stage: string, reason: unknown): { error: string; status: number } | { reason: string } {
  if (stage !== 'watching') return { error: 'Only a market at the watching stage can be removed. Move it to paused instead, with the reason.', status: 409 };
  const r = str(reason, 2000);
  if (!r || r.length < MIN_NOTE) return { error: `Say why it is being removed, in at least ${MIN_NOTE} characters.`, status: 400 };
  return { reason: r };
}

export type BoardSummary = {
  counts: Record<Stage, number>;
  total: number;
  overdue: { id: string; name: string; nextStep: string | null; nextStepDue: string }[];
};

/** Today's date as YYYY-MM-DD in UTC. */
export const todayIso = (now = new Date()) => now.toISOString().slice(0, 10);

/** A next step is overdue when its due date is before today and the market is not paused. */
export function isOverdue(m: { stage: string; nextStepDue: string | null }, today: string): boolean {
  return !!m.nextStepDue && m.stage !== 'paused' && m.nextStepDue < today;
}

/** Counts per stage and the overdue next steps, oldest first. Pure. */
export function summarise(
  rows: { id: string; name: string; stage: string; nextStep: string | null; nextStepDue: string | null }[],
  today: string,
): BoardSummary {
  const counts = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<Stage, number>;
  const overdue: BoardSummary['overdue'] = [];
  for (const r of rows) {
    if (isStage(r.stage)) counts[r.stage]++;
    if (isOverdue(r, today)) overdue.push({ id: r.id, name: r.name, nextStep: r.nextStep, nextStepDue: r.nextStepDue! });
  }
  overdue.sort((a, b) => a.nextStepDue.localeCompare(b.nextStepDue));
  return { counts, total: rows.length, overdue };
}
