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

