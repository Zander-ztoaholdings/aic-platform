/**
 * The risk register's arithmetic. A risk is scored likelihood × impact, each
 * 1 to 5, the common 5×5 matrix (ISO 31000 practice; the same shape ISO 27001
 * clause 6.1.2 auditors expect). Bands are AIC's defaults and are shown on the
 * page, so nobody has to guess what "high" means.
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export const score = (likelihood: number, impact: number) => likelihood * impact;

export function level(s: number): RiskLevel {
  if (s >= 20) return 'critical';
  if (s >= 10) return 'high';
  if (s >= 5) return 'medium';
  return 'low';
}

export const LEVEL_LABEL: Record<RiskLevel, string> = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };
export const LIKELIHOOD = ['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost certain'];
export const IMPACT = ['Negligible', 'Minor', 'Moderate', 'Major', 'Severe'];
export const CATEGORIES = ['security', 'privacy', 'ai', 'operational', 'compliance', 'supplier'] as const;
export const CATEGORY_LABEL: Record<string, string> = { security: 'Security', privacy: 'Privacy', ai: 'AI', operational: 'Operational', compliance: 'Compliance', supplier: 'Supplier' };
export const TREATMENTS = ['mitigate', 'accept', 'transfer', 'avoid'] as const;
export const TREATMENT_LABEL: Record<string, string> = { mitigate: 'Reduce it', accept: 'Accept it', transfer: 'Transfer it', avoid: 'Avoid it' };
export const STATUSES = ['open', 'treating', 'accepted', 'closed'] as const;
export const STATUS_LABEL: Record<string, string> = { open: 'Open', treating: 'Being treated', accepted: 'Accepted', closed: 'Closed' };

/** Count of open risks in each cell of the 5×5 grid, [likelihood-1][impact-1]. */
export function heatmap(rows: { likelihood: number; impact: number; status: string }[]): number[][] {
  const g = Array.from({ length: 5 }, () => Array(5).fill(0) as number[]);
  for (const r of rows) if (r.status !== 'closed') g[r.likelihood - 1][r.impact - 1]++;
  return g;
}

export type RiskInput = {
  title: string; description: string | null; category: string; likelihood: number; impact: number;
  residualLikelihood: number | null; residualImpact: number | null; treatment: string; treatmentPlan: string | null;
  controls: string[]; ownerName: string | null; status: string; reviewAt: Date | null;
};

const int = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) ? v : typeof v === 'string' && /^\d$/.test(v) ? Number(v) : NaN);

/** Validates a risk from a request. */
export function validateRisk(b: unknown, knownControls: Set<string>): { error: string } | { value: RiskInput } {
  const o = (b ?? {}) as Record<string, unknown>;
  const title = typeof o.title === 'string' ? o.title.trim() : '';
  if (title.length < 3) return { error: 'Describe the risk in a few words.' };
  const L = int(o.likelihood), I = int(o.impact);
  if (!(L >= 1 && L <= 5) || !(I >= 1 && I <= 5)) return { error: 'Choose a likelihood and an impact.' };
  const rl = o.residualLikelihood == null || o.residualLikelihood === '' ? null : int(o.residualLikelihood);
  const ri = o.residualImpact == null || o.residualImpact === '' ? null : int(o.residualImpact);
  if ((rl !== null && !(rl >= 1 && rl <= 5)) || (ri !== null && !(ri >= 1 && ri <= 5))) return { error: 'The remaining likelihood and impact must be 1 to 5.' };
  const category = CATEGORIES.includes(o.category as never) ? (o.category as string) : 'security';
  const treatment = TREATMENTS.includes(o.treatment as never) ? (o.treatment as string) : 'mitigate';
  const status = STATUSES.includes(o.status as never) ? (o.status as string) : 'open';
  const controls = Array.isArray(o.controls) ? [...new Set(o.controls.filter((k): k is string => typeof k === 'string' && knownControls.has(k)))].slice(0, 8) : [];
  const str = (v: unknown, n: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null);
  const reviewAt = typeof o.reviewAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.reviewAt) ? new Date(o.reviewAt + 'T00:00:00Z') : null;
  return { value: { title: title.slice(0, 200), description: str(o.description, 4000), category, likelihood: L, impact: I, residualLikelihood: rl, residualImpact: ri, treatment, treatmentPlan: str(o.treatmentPlan, 4000), controls, ownerName: str(o.ownerName, 200), status, reviewAt } };
}

// ── Inherent, current and target scores ──────────────────────────────────────

export type Scored = { likelihood: number; impact: number; residualLikelihood: number | null; residualImpact: number | null; status: string; treatment: string };
export type ScoreView = { likelihood: number; impact: number; score: number; level: RiskLevel };
const view = (l: number, i: number): ScoreView => ({ likelihood: l, impact: i, score: l * i, level: level(l * i) });

/** Before any treatment: likelihood × impact as the person recorded it. */
export const inherent = (r: Scored): ScoreView => view(r.likelihood, r.impact);

/** Where the person expects the risk to sit once treated, if they recorded it. */
export const target = (r: Scored): ScoreView | null =>
  r.residualLikelihood && r.residualImpact ? view(r.residualLikelihood, r.residualImpact) : null;

/**
 * Where the risk sits today, by AIC's reckoning. It starts from the recorded
 * target once a treatment is under way (being treated or accepted) and from
 * the inherent score otherwise. Each piece of failing evidence (a linked
 * control with a gap, or a signal AIC noticed) adds one to the likelihood,
 * at most two, never past 5. It is shown next to what the person recorded,
 * never written over it.
 */
export function current(r: Scored, failing: number): ScoreView & { raisedBy: number; from: ScoreView } {
  const t = target(r);
  const from = t && (r.status === 'treating' || r.status === 'accepted') ? t : inherent(r);
  if (r.status === 'closed') return { ...from, raisedBy: 0, from };
  const raisedBy = Math.min(2, Math.max(0, failing), 5 - from.likelihood);
  return { ...view(from.likelihood + raisedBy, from.impact), raisedBy, from };
}

// ── Review cadence ───────────────────────────────────────────────────────────

/** Months between reviews: high and critical every 3, medium every 6, low every 12. */
export function reviewMonths(s: number): number {
  const l = level(s);
  return l === 'critical' || l === 'high' ? 3 : l === 'medium' ? 6 : 12;
}

export function nextReviewAt(s: number, from = new Date()): Date {
  const d = new Date(from);
  d.setUTCMonth(d.getUTCMonth() + reviewMonths(s));
  return d;
}

// ── Acceptance ───────────────────────────────────────────────────────────────

export type Acceptance = { acceptedBy: string; acceptReason: string; acceptUntil: string };

/** A risk can only be accepted by a named approver, for a stated reason, until a date at most a year away. */
export function validateAcceptance(b: unknown, today = new Date()): { error: string } | { value: Acceptance } {
  const o = (b ?? {}) as Record<string, unknown>;
  const by = typeof o.acceptedBy === 'string' ? o.acceptedBy.trim() : '';
  const why = typeof o.acceptReason === 'string' ? o.acceptReason.trim() : '';
  const until = typeof o.acceptUntil === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.acceptUntil) ? o.acceptUntil : '';
  if (by.length < 2) return { error: 'Name the person who approved accepting this risk.' };
  if (why.length < 10) return { error: 'Say why the risk is being accepted.' };
  if (!until) return { error: 'Choose the date the acceptance runs until.' };
  const t = today.toISOString().slice(0, 10);
  const max = new Date(today); max.setUTCFullYear(max.getUTCFullYear() + 1);
  if (until <= t) return { error: 'The acceptance must run until a date in the future.' };
  if (until > max.toISOString().slice(0, 10)) return { error: 'Accept a risk for a year at most, then decide again.' };
  return { value: { acceptedBy: by.slice(0, 200), acceptReason: why.slice(0, 2000), acceptUntil: until } };
}

/** Whether an acceptance has run out. */
export const acceptanceExpired = (until: string | null | undefined, now = new Date()) => !!until && until < now.toISOString().slice(0, 10);

// ── History ──────────────────────────────────────────────────────────────────

export type RiskEventKind = 'created' | 'scored' | 'treatment' | 'reviewed' | 'signal' | 'closed' | 'reopened';
export type RiskEventDraft = { kind: RiskEventKind; detail: Record<string, unknown> };

/** The events a change from `a` to `b` should record. */
export function changeEvents(a: RiskInput, b: RiskInput, acceptance: { before: Acceptance | null; after: Acceptance | null } = { before: null, after: null }): RiskEventDraft[] {
  const out: RiskEventDraft[] = [];
  const scoreOf = (x: RiskInput) => ({ likelihood: x.likelihood, impact: x.impact, residualLikelihood: x.residualLikelihood, residualImpact: x.residualImpact });
  const sa = scoreOf(a), sb = scoreOf(b);
  if (JSON.stringify(sa) !== JSON.stringify(sb)) {
    out.push({ kind: 'scored', detail: { from: { ...sa, score: score(a.likelihood, a.impact) }, to: { ...sb, score: score(b.likelihood, b.impact) } } });
  }
  const accepted = b.treatment === 'accept' && acceptance.after;
  const acceptChanged = accepted && JSON.stringify(acceptance.before) !== JSON.stringify(acceptance.after);
  if (a.treatment !== b.treatment || (a.treatmentPlan ?? '') !== (b.treatmentPlan ?? '') || acceptChanged) {
    out.push({ kind: 'treatment', detail: { from: a.treatment, to: b.treatment, plan: b.treatmentPlan, ...(accepted ? acceptance.after : {}) } });
  }
  if (a.status !== 'closed' && b.status === 'closed') out.push({ kind: 'closed', detail: { from: a.status } });
  else if (a.status === 'closed' && b.status !== 'closed') out.push({ kind: 'reopened', detail: { to: b.status } });
  return out;
}
