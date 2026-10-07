/**
 * Importing a vendor's own user export, for AI products with no reporting API
 * on the organisation's plan: ChatGPT workspace analytics (Enterprise and
 * Edu export a users CSV) and Claude Team or Enterprise admin exports.
 *
 * Column names differ between vendors and change over time, so columns are
 * found by what they are called rather than where they sit: an email column
 * is required; a name, a message count and a last-active date are used when
 * present. Nothing else in the file is kept.
 */
import { parseCsv } from '../connectors/http';
import { AI_PRODUCTS, isoDay, type AiProduct, type AiUseRecord } from './products';

export type ImportResult = { records: AiUseRecord[]; problems: string[]; columns: { email: string; name?: string; activity?: string; lastActive?: string } | null };

const find = (headers: string[], tests: RegExp[], not?: RegExp) => {
  for (const t of tests) {
    const h = headers.find((x) => t.test(x.trim()) && !(not && not.test(x)));
    if (h) return h;
  }
  return undefined;
};

/** "1,234" → 1234; blank → 0. */
const count = (v: string | undefined) => {
  const n = Number((v ?? '').replace(/[\s,]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
};

/** A date the export gives, as an ISO timestamp, or null. Accepts ISO dates and the common d/m/y and m/d/y forms only when unambiguous. */
export function exportDate(v: string | undefined): string | null {
  const s = (v ?? '').trim();
  if (!s || /^(never|n\/a|-|none)$/i.test(s)) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`;
  const dmy = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})/);
  if (dmy) {
    const [a, b] = [Number(dmy[1]), Number(dmy[2])];
    // Only when one part cannot be a month; otherwise the date is ambiguous and dropped.
    const [day, month] = a > 12 ? [a, b] : b > 12 ? [b, a] : [0, 0];
    if (!day) return null;
    return `${dmy[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00Z`;
  }
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

export function parseUsageExport(csv: string, product: AiProduct, now = new Date()): ImportResult {
  const rows = parseCsv(csv.replace(/^\uFEFF/, ''));
  if (!rows.length) return { records: [], problems: ['The file has no rows under its header.'], columns: null };
  const headers = Object.keys(rows[0]);
  const email = find(headers, [/^e-?mail( address)?$/i, /e-?mail/i]);
  if (!email) return { records: [], problems: ['AIC could not find an email column. The export needs one column of email addresses.'], columns: null };
  const name = find(headers, [/^(full )?name$/i, /^display name$/i, /^user ?name$/i], /e-?mail/i);
  const activity = find(headers, [/^(total )?messages?( sent| count)?$/i, /messages?/i, /conversations?/i], /last|date/i);
  const lastActive = find(headers, [/last.*(active|activity|used|seen|message)/i, /^last/i]);

  const day = isoDay(now);
  const problems: string[] = [];
  const seen = new Set<string>();
  const records: AiUseRecord[] = [];
  let skipped = 0;
  for (const r of rows.slice(0, 20_000)) {
    const e = (r[email] ?? '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { skipped++; continue; }
    if (seen.has(e)) continue;
    seen.add(e);
    records.push({
      product, subjectType: 'person', subject: e, displayName: name ? r[name]?.trim() || null : null, day,
      lastActiveAt: lastActive ? exportDate(r[lastActive]) : null,
      activity: activity ? count(r[activity]) : 0,
      metrics: { imported: true },
    });
  }
  if (skipped) problems.push(`${skipped} row${skipped === 1 ? '' : 's'} had no valid email address and ${skipped === 1 ? 'was' : 'were'} left out.`);
  if (!activity && !lastActive) problems.push(`The file has no message count or last-active column, so AIC recorded who holds a ${AI_PRODUCTS[product].name} seat but not whether they use it.`);
  return { records, problems, columns: { email, name, activity, lastActive } };
}
