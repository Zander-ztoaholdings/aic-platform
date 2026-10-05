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
