/**
 * Making a human override quick to record.
 *
 * The person overriding a decision already knows what they changed and why;
 * the record should cost them two taps, not a form. The decision itself
 * supplies the system and the original outcome. The likely new outcomes are
 * the other outcomes this system produces. The likely reasons are the ones
 * this organisation has given before for this system, then a short standard
 * list. A free-text detail is optional, except for "Something else".
 *
 * The note is stored as "<reason>: <detail>", so overrides can later be
 * counted by reason without a schema change.
 *
 * Pure: tested in __tests__/lib/override.test.ts.
 */

export const STANDARD_REASONS = [
  'Information the system did not have',
  'Error in the data the system used',
  "The customer's circumstances",
  'Policy exception approved',
  'The system was wrong',
] as const;

export const OTHER_REASON = 'Something else';
const MIN_NOTE = 10;

type Row = { systemName: string; outcome: unknown; isHumanOverride?: boolean | null; overrideReason?: string | null; finalOutcome?: unknown };

/** "approved", or the `decision` field of an object outcome; null when there is no short form. */
export function outcomeLabel(v: unknown): string | null {
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v && typeof v === 'object' && typeof (v as { decision?: unknown }).decision === 'string') return ((v as { decision: string }).decision).trim() || null;
  return null;
}

/** Other outcomes this system has produced (or people chose), most frequent first, at most four. */
export function outcomeOptions(rows: Row[], systemName: string, current: unknown): string[] {
  const now = outcomeLabel(current)?.toLowerCase();
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (r.systemName !== systemName) continue;
    for (const v of [r.outcome, r.finalOutcome]) {
      const l = outcomeLabel(v);
      if (l && l.toLowerCase() !== now && l.length <= 60) counts.set(l, (counts.get(l) ?? 0) + 1);
    }
  }
  return [...counts].sort((a, b) => b[1] - a[1]).map(([l]) => l).slice(0, 4);
}

export const reasonOf = (note: string | null | undefined) => {
  if (!note) return null;
  const i = note.indexOf(': ');
  return (i > 0 ? note.slice(0, i) : note).trim().slice(0, 80) || null;
};

/** Reasons this organisation has used for this system before, then the standard ones; at most six. */
export function reasonOptions(rows: Row[], systemName: string): string[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (r.systemName !== systemName || !r.isHumanOverride) continue;
    const reason = reasonOf(r.overrideReason);
    if (reason && reason.length >= MIN_NOTE && reason !== OTHER_REASON) counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  const used = [...counts].sort((a, b) => b[1] - a[1]).map(([l]) => l).slice(0, 3);
  return [...used, ...STANDARD_REASONS.filter((s) => !used.includes(s))].slice(0, 6);
}

/** The stored note, or an error message for the person. */
export function composeNote(reason: string | null, detail: string): { note: string } | { error: string } {
  const d = detail.trim();
  if (!reason) return { error: 'Choose why you are changing it.' };
  if (reason === OTHER_REASON) {
    return d.length >= MIN_NOTE ? { note: `${OTHER_REASON}: ${d}` } : { error: 'Say in a few words why you are changing it.' };
  }
  return { note: d ? `${reason}: ${d}` : reason };
}

/** The new outcome in the same shape as the system's: a string, or an object with `decision`. */
export function shapeOutcome(original: unknown, label: string): unknown {
  return original && typeof original === 'object' && !Array.isArray(original) ? { decision: label } : label;
}
