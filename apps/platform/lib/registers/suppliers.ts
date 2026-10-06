/**
 * Supplier register rules. How often a supplier is reviewed follows from how
 * much rides on it: high every 12 months, medium every 24, low every 36.
 * A supplier holding personal information outside South Africa needs a
 * written agreement (POPIA s72 and ss20-21), so the register flags it.
 */
export const CATEGORIES = ['ai_provider', 'cloud', 'software', 'payroll_hr', 'payments', 'professional', 'other'] as const;
export const CATEGORY_LABEL: Record<string, string> = {
  ai_provider: 'AI provider', cloud: 'Cloud and hosting', software: 'Software', payroll_hr: 'Payroll and HR',
  payments: 'Payments', professional: 'Professional services', other: 'Other',
};
export const DATA_KINDS = ['personal', 'special', 'financial', 'credentials', 'none'] as const;
export const DATA_LABEL: Record<string, string> = {
  personal: 'Personal information', special: 'Special personal information', financial: 'Financial', credentials: 'System access', none: 'No data',
};
export const REVIEW_MONTHS: Record<string, number> = { high: 12, medium: 24, low: 36 };
export const OUTCOME_LABEL: Record<string, string> = { approved: 'Approved', approved_with_conditions: 'Approved with conditions', rejected: 'Not approved' };

export type SupplierState = 'not_reviewed' | 'due' | 'current' | 'rejected';

export function supplierState(s: { nextReviewAt: Date | string | null; lastOutcome: string | null }, now = Date.now()): SupplierState {
  if (!s.lastOutcome) return 'not_reviewed';
  if (s.lastOutcome === 'rejected') return 'rejected';
  if (s.nextReviewAt && new Date(s.nextReviewAt).getTime() < now) return 'due';
  return 'current';
}

export const nextReview = (criticality: string, from = new Date()) => {
  const d = new Date(from);
  d.setUTCMonth(d.getUTCMonth() + (REVIEW_MONTHS[criticality] ?? 24));
  return d;
};

/** What the register should warn about for one supplier. */
export function supplierFlags(s: { dataShared: string[]; outsideSa: boolean; hasDpa: boolean; criticality: string }): string[] {
  const out: string[] = [];
  const personal = s.dataShared.some((d) => d === 'personal' || d === 'special');
  if (personal && !s.hasDpa) out.push('Holds personal information with no written data processing agreement (POPIA s21).');
  if (personal && s.outsideSa && !s.hasDpa) out.push('Personal information leaves South Africa without an agreement that protects it (POPIA s72).');
  if (s.dataShared.includes('special') && s.criticality === 'low') out.push('Holds special personal information but is rated low criticality.');
  return out;
}

/** Suppliers AIC already knows about from the connected systems, as suggestions. */
export const KNOWN_SUPPLIERS: Record<string, { name: string; website: string; category: string; country: string; dataShared: string[] }> = {
  openai: { name: 'OpenAI', website: 'https://openai.com', category: 'ai_provider', country: 'United States', dataShared: ['personal'] },
  anthropic: { name: 'Anthropic', website: 'https://www.anthropic.com', category: 'ai_provider', country: 'United States', dataShared: ['personal'] },
  github: { name: 'GitHub', website: 'https://github.com', category: 'software', country: 'United States', dataShared: ['credentials'] },
  microsoft: { name: 'Microsoft 365', website: 'https://www.microsoft.com', category: 'cloud', country: 'South Africa or other regions', dataShared: ['personal'] },
};

/** Validates a supplier from a request. */
export function cleanSupplier(b: Record<string, unknown>) {
  const str = (v: unknown, n: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null);
  const name = str(b.name, 200);
  if (!name) return { error: 'Give the supplier a name.' } as const;
  const website = str(b.website, 300);
  if (website && !/^https?:\/\//i.test(website)) return { error: 'The website should start with https://' } as const;
  return {
    value: {
      name, website, purpose: str(b.purpose, 2000), country: str(b.country, 80), ownerName: str(b.ownerName, 200),
      category: CATEGORIES.includes(b.category as never) ? (b.category as string) : 'software',
      dataShared: Array.isArray(b.dataShared) ? [...new Set(b.dataShared.filter((d): d is string => DATA_KINDS.includes(d as never)))] : [],
      outsideSa: b.outsideSa === true, hasDpa: b.hasDpa === true,
      criticality: ['high', 'medium', 'low'].includes(b.criticality as string) ? (b.criticality as string) : 'medium',
    },
  } as const;
}


// ── Supplier security documents ─────────────────────────────────────────────
// AIC's first read of a supplier's SOC 2 report, ISO certificate, pen test
// summary, DPA or questionnaire answers. The shape lives here (not in lib/ai)
// so the browser can import it; lib/ai/supplier-doc.ts produces it.

export const DOC_KINDS = ['soc2_type2', 'soc2_type1', 'iso27001', 'pentest', 'dpa', 'questionnaire', 'other'] as const;
export type SupplierDocKind = (typeof DOC_KINDS)[number];
export const DOC_KIND_LABEL: Record<SupplierDocKind, string> = {
  soc2_type2: 'SOC 2 Type 2 report', soc2_type1: 'SOC 2 Type 1 report', iso27001: 'ISO 27001 certificate',
  pentest: 'Penetration test summary', dpa: 'Data processing agreement', questionnaire: 'Security questionnaire answers', other: 'Other document',
};

export type SupplierDocFindings = {
  kind: SupplierDocKind;
  issuer: string | null;
  coversFrom: string | null;
  coversTo: string | null;
  expires: string | null;
  scope: string | null;
  exceptions: string[];
  dataLocations: string[];
  subprocessors: string[];
  personalInformation: 'mentioned' | 'not mentioned';
  concerns: string[];
  suggestedOutcome: 'approved' | 'approved_with_conditions' | 'rejected' | null;
  suggestedNotes: string;
  /** Anything the reader could not do, e.g. a PDF with the AI service off, or the file not kept. */
  readNote?: string | null;
};

const DAY = 86_400_000;
const isoDay = (v: string | null | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? Date.parse(`${v}T23:59:59Z`) : NaN);

/** Why a document is out of date, or null when it is not (or its dates are unknown). */
export function docOutOfDate(f: Pick<SupplierDocFindings, 'expires' | 'coversTo'>, now = Date.now()): 'expired' | 'stale' | null {
  const exp = isoDay(f.expires);
  if (!Number.isNaN(exp) && exp < now) return 'expired';
  const to = isoDay(f.coversTo);
  if (!Number.isNaN(to) && to < now - 365 * DAY) return 'stale';
  return null;
}

export const STALE_DOC_FLAG = 'Their latest security report is out of date.';

/** Register flag from a supplier's document reads: only the newest one counts. */
export function documentConcerns(reads: { createdAt: Date | string; findings: unknown }[], now = Date.now()): string[] {
  if (!reads.length) return [];
  const latest = [...reads].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  const f = (latest.findings ?? {}) as Partial<SupplierDocFindings>;
  return docOutOfDate({ expires: f.expires ?? null, coversTo: f.coversTo ?? null }, now) ? [STALE_DOC_FLAG] : [];
}
