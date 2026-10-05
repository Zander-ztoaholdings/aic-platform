/** The shape of AIC's first read of a document; safe to import in the browser. */
export type Triage = {
  verdict: 'looks_right' | 'partly' | 'not_relevant' | 'unreadable';
  summary: string;
  missing: string[];
  documentDate: string | null;
  model: string;
  at: string;
};

/** Stored in audit_documents.ai_triage_notes as JSON; older rows may hold plain text. */
export function parseTriage(raw: string | null | undefined): Triage | null {
  if (!raw) return null;
  try { const t = JSON.parse(raw) as Triage; return t && typeof t.verdict === 'string' ? t : null; } catch { return null; }
}

export const TRIAGE_LABEL: Record<Triage['verdict'], string> = {
  looks_right: 'Looks like the right evidence',
  partly: 'Partly there',
  not_relevant: 'Does not look like evidence of this',
  unreadable: 'AIC could not read it',
};
