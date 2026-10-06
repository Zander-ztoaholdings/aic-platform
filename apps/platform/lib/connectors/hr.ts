/**
 * Helpers shared by the HR connectors: dates and emails in one shape, and the
 * people_list check every HR connector runs.
 */
import { result, plural } from './http';
import type { PersonRecord } from './types';
import type { CheckResult } from '../integrations/catalog';


/** A date as YYYY-MM-DD, or null for empty, '0000-00-00' or anything unreadable. Accepts ISO strings and DD/MM/YYYY. */
export function isoDate(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s || s.startsWith('0000-00-00')) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** A trimmed, lower-cased email, or null. */
export const lowerEmail = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim().toLowerCase() : null);

/** The text of a value that may be a string or an object with a name/value. */
export function textOf(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return textOf(o.name ?? o.value ?? o.title ?? o.label ?? null);
  }
  return null;
}

/**
 * The single check every HR connector runs: does the list come back, and does
 * it carry the dates the leavers check depends on. `alsoLeft` counts people
 * the provider marks as gone but without a leaving date.
 */
export function peopleListCheck(checkKey: string, subject: string, people: PersonRecord[], now: Date, alsoLeft = 0): CheckResult {
  if (!people.length) return result(checkKey, subject, 'unknown', 'AIC could not read anyone from the employee list. The credential may not be allowed to see people.');
  const today = now.toISOString().slice(0, 10);
  const left = people.filter((p) => p.endDate && p.endDate <= today).length + alsoLeft;
  const withStart = people.filter((p) => p.startDate).length;
  const withEnd = people.filter((p) => p.endDate).length;
  const count = `${plural(people.length, 'person', 'people')}, ${left} of whom ${left === 1 ? 'has' : 'have'} left.`;
  if (!withStart) return result(checkKey, subject, 'warn', `${count} AIC cannot see start or leaving dates; check the credential can read employment fields.`, { people: people.length, left, withStart, withEnd });
  return result(checkKey, subject, 'pass', count, { people: people.length, left, withStart, withEnd });
}

// ── BambooHR ───────────────────────────────────────────────────────────────
