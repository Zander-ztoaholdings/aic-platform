/**
 * Storing AI use readings, summarising them for the page, and the register
 * check that turns "people use this" into "it should be on your AI register".
 */
import { getTenantDb, aiToolUse, eq, and, gte, desc } from '@aic/db';
import type { CheckResult } from '../integrations/catalog';
import { AI_PRODUCTS, declaredFor, isoDay, type AiProduct, type AiUseRecord } from './products';

const missingTable = (e: unknown) => {
  const code = (e as { code?: string }).code ?? (e as { cause?: { code?: string } }).cause?.code;
  return code === '42P01';
};

/** Upserts readings. Returns how many were stored; 0 (not an error) before migration 020 is applied. */
export async function saveAiUse(orgId: string, source: string, records: AiUseRecord[], now = new Date()): Promise<number> {
  if (!records.length) return 0;
  try {
    await getTenantDb(orgId).query(async (tx) => {
      for (const r of records.slice(0, 20_000)) {
        const values = {
          source,
          displayName: r.displayName?.slice(0, 255) ?? null,
          lastActiveAt: r.lastActiveAt ? new Date(r.lastActiveAt) : null,
          activity: Math.round(r.activity),
          metrics: r.metrics ?? {},
          observedAt: now,
        };
        await tx.insert(aiToolUse)
          .values({ orgId, product: r.product, subjectType: r.subjectType, subject: r.subject.slice(0, 255), day: r.day, ...values })
          .onConflictDoUpdate({ target: [aiToolUse.orgId, aiToolUse.product, aiToolUse.subjectType, aiToolUse.subject, aiToolUse.day], set: values });
      }
    });
    return records.length;
  } catch (e) {
    if (missingTable(e)) return 0;
    throw e;
  }
}

export type ProductSummary = {
  product: AiProduct;
  name: string;
  vendor: string;
  via: string;
  subjectKind: 'person' | 'model';
  unit: string;
  /** Distinct people (or models) active in the window. */
  active: number;
  activity: number;
  lastActiveAt: string | null;
  sources: string[];
  declaredAs: string | null;
  subjects: { subject: string; displayName: string | null; lastActiveAt: string | null; activity: number; detail: string | null }[];
};

const DETAIL_KEYS: [string, string][] = [['apps', ''], ['editor', 'in '], ['conversations', 'conversations: '], ['region', ''], ['account', '']];

function detailOf(m: Record<string, unknown>): string | null {
  for (const [k, prefix] of DETAIL_KEYS) {
    const v = m[k];
    if (v !== null && v !== undefined && v !== '' && v !== 0) return `${prefix}${v}`;
  }
  return null;
}

/** The last `days` of readings, by product, newest first within each. */
export async function summariseAiUse(orgId: string, systemNames: string[], days = 30, now = new Date()): Promise<ProductSummary[]> {
  const since = isoDay(new Date(now.getTime() - days * 86_400_000));
  let rows: (typeof aiToolUse.$inferSelect)[];
  try {
    rows = await getTenantDb(orgId).query((tx) =>
      tx.select().from(aiToolUse).where(and(eq(aiToolUse.orgId, orgId), gte(aiToolUse.day, since))).orderBy(desc(aiToolUse.day)).limit(50_000));
  } catch (e) {
    if (missingTable(e)) return [];
    throw e;
  }
  const by = new Map<AiProduct, typeof rows>();
  for (const r of rows) {
    if (!(r.product in AI_PRODUCTS)) continue;
    const list = by.get(r.product as AiProduct) ?? [];
    list.push(r);
    by.set(r.product as AiProduct, list);
  }
  const out: ProductSummary[] = [];
  for (const [product, list] of by) {
    const def = AI_PRODUCTS[product];
    const subjects = new Map<string, ProductSummary['subjects'][number]>();
    let activity = 0;
    let last: string | null = null;
    for (const r of list) {
      activity += Number(r.activity ?? 0);
      const at = r.lastActiveAt ? new Date(r.lastActiveAt).toISOString() : null;
      if (at && (!last || at > last)) last = at;
      const s = subjects.get(r.subject) ?? { subject: r.subject, displayName: r.displayName, lastActiveAt: null, activity: 0, detail: null };
      s.activity += Number(r.activity ?? 0);
      if (at && (!s.lastActiveAt || at > s.lastActiveAt)) s.lastActiveAt = at;
      s.detail = s.detail ?? detailOf((r.metrics ?? {}) as Record<string, unknown>);
      s.displayName = s.displayName ?? r.displayName;
      subjects.set(r.subject, s);
    }
    // A seat with no use in the window is a seat, not a user: kept in the list, not counted as active.
    const cutoff = new Date(now.getTime() - days * 86_400_000).toISOString();
    const activeSubjects = [...subjects.values()].filter((s) => s.activity > 0 || (s.lastActiveAt !== null && s.lastActiveAt >= cutoff));
    out.push({
      product, name: def.name, vendor: def.vendor, via: def.via, subjectKind: def.subject, unit: def.unit,
      active: activeSubjects.length, activity, lastActiveAt: last,
      sources: [...new Set(list.map((r) => r.source))],
      declaredAs: declaredFor(product, systemNames),
      subjects: [...subjects.values()].sort((a, b) => (b.lastActiveAt ?? '').localeCompare(a.lastActiveAt ?? '') || b.activity - a.activity).slice(0, 500),
    });
  }
  return out.sort((a, b) => b.active - a.active || a.name.localeCompare(b.name));
}

/**
 * The register check for each product a source reported use of: pass when a
 * declared system covers it, warn when people use it and nothing does. Warn,
 * not fail: an assistant used for drafting is not a decision about a person,
 * but it still belongs on the register with someone accountable for it.
 */
export function registerChecks(records: AiUseRecord[], systemNames: string[], now = new Date(), days = 30): CheckResult[] {
  const cutoff = isoDay(new Date(now.getTime() - days * 86_400_000));
  const seen = new Map<AiProduct, Set<string>>();
  for (const r of records) {
    // A seat counts when its last use falls in the window; a daily reading when it shows any use.
    const recent = r.lastActiveAt ? r.lastActiveAt.slice(0, 10) >= cutoff : r.activity > 0 && r.day >= cutoff;
    if (!recent) continue;
    const set = seen.get(r.product) ?? new Set<string>();
    set.add(r.subject);
    seen.set(r.product, set);
  }
  return [...seen.entries()].map(([product, subjects]) => {
    const def = AI_PRODUCTS[product];
    const n = subjects.size;
    const who = def.subject === 'person' ? `${n} ${n === 1 ? 'person uses' : 'people use'}` : `${n} ${n === 1 ? 'model is' : 'models are'} in use in`;
    const declared = declaredFor(product, systemNames);
    return declared
      ? { checkKey: 'ai.tool_on_register', subject: def.name, status: 'pass' as const, summary: `${who} ${def.name}. It is on your AI register as "${declared}".`, detail: { product, active: n, declaredAs: declared } }
      : { checkKey: 'ai.tool_on_register', subject: def.name, status: 'warn' as const, summary: `${who} ${def.name}, and nothing on your AI register covers it.`, detail: { product, active: n } };
  });
}
