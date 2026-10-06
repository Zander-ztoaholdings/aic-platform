/**
 * A first read of a supplier's security document: SOC 2 report, ISO 27001
 * certificate, penetration test summary, data processing agreement or
 * security questionnaire answers.
 *
 * AIC's model reads it when AIC_AI_API_KEY is set; otherwise (or when the
 * model fails) a rule-based reader picks out the report type, the dates and
 * any exception wording. Either way the result only pre-fills the supplier
 * review: a named person records the outcome.
 */
import { askJson, aiConfigured, type ContentBlock } from './claude';
import { docxText } from './docx-text';
import { DOC_KINDS, DOC_KIND_LABEL, docOutOfDate, type SupplierDocFindings, type SupplierDocKind } from '@/lib/registers/suppliers';

export type { SupplierDocFindings } from '@/lib/registers/suppliers';

export const MAX_TEXT = 60_000;
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const ACCEPTED_EXT = ['pdf', 'docx', 'txt', 'md'] as const;

export type SupplierContext = { name: string; purpose?: string | null; outsideSa: boolean; hasDpa: boolean; dataShared: string[] };

export const PDF_NEEDS_AI = 'AIC cannot read PDFs without its AI service, which is not switched on here. Read the report yourself, or upload a Word or text copy.';

/** What can be read from an uploaded file: its text, or (for a PDF) the file for the model. */
export function extractSupplierText(fileName: string, buf: Buffer): { text: string; pdf?: undefined } | { text: ''; pdf: Buffer } | { error: string } {
  const ext = (fileName.split('.').pop() ?? '').toLowerCase();
  if (ext === 'pdf') return { text: '', pdf: buf };
  if (ext === 'txt' || ext === 'md') return { text: buf.toString('utf8').slice(0, MAX_TEXT) };
  if (ext === 'docx') {
    const t = docxText(buf);
    return t ? { text: t.slice(0, MAX_TEXT) } : { error: 'AIC could not read the text of this Word document.' };
  }
  return { error: 'Upload a PDF, Word (.docx), text or Markdown file.' };
}

// ── Dates ───────────────────────────────────────────────────────────────────

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MON = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const DATE_RE = new RegExp(
  `(\\d{4})-(\\d{2})-(\\d{2})|(\\d{1,2})(?:st|nd|rd|th)?\\s+${MON}\\.?,?\\s+(\\d{4})|${MON}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})|(\\d{1,2})[/.](\\d{1,2})[/.](\\d{4})`,
  'gi',
);
const pad = (n: number) => String(n).padStart(2, '0');
const monthIdx = (m: string) => MONTHS.findIndex((x) => x.startsWith(m.toLowerCase().slice(0, 3))) + 1;
function toIso(y: number, m: number, d: number): string | null {
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCMonth() === m - 1 ? `${y}-${pad(m)}-${pad(d)}` : null;
}

/** Every date in a stretch of text, in order, as YYYY-MM-DD. Slashed dates are read day first. */
export function datesIn(s: string): string[] {
  const out: string[] = [];
  for (const m of s.matchAll(DATE_RE)) {
    let v: string | null = null;
    if (m[1]) v = toIso(+m[1], +m[2], +m[3]);
    else if (m[4]) v = toIso(+m[6], monthIdx(m[5]), +m[4]);
    else if (m[7]) v = toIso(+m[9], monthIdx(m[7]), +m[8]);
    else if (m[10]) v = toIso(+m[12], +m[11], +m[10]);
    if (v) out.push(v);
  }
  return out;
}

const isoOrNull = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && toIso(+v.slice(0, 4), +v.slice(5, 7), +v.slice(8, 10)) ? v : null);

// ── Rules ───────────────────────────────────────────────────────────────────

function detectKind(t: string): SupplierDocKind {
  if (/\bSOC\s*2\b|\bSOC2\b|service organi[sz]ation control/i.test(t)) {
    if (/type\s*(ii|2)\b/i.test(t)) return 'soc2_type2';
    if (/type\s*(i|1)\b/i.test(t)) return 'soc2_type1';
    return 'soc2_type2';
  }
  if (/ISO\s*\/?\s*(IEC\s*)?27001/i.test(t)) return 'iso27001';
  if (/penetration test|pen[- ]?test/i.test(t)) return 'pentest';
  if (/data processing (agreement|addendum)|\bDPA\b|operator agreement/i.test(t)) return 'dpa';
  if (/questionnaire|\bCAIQ\b|\bSIG (lite|core)\b/i.test(t)) return 'questionnaire';
  return 'other';
}

const KNOWN_ISSUERS = ['Deloitte', 'PwC', 'PricewaterhouseCoopers', 'KPMG', 'Ernst & Young', 'EY', 'BDO', 'Grant Thornton', 'Mazars', 'Schellman', 'A-LIGN', 'Coalfire', 'BSI', 'SGS', 'Bureau Veritas', 'DNV', 'LRQA', 'TÜV SÜD', 'TÜV Rheinland', 'Intertek', 'NQA', 'SABS'];

function detectIssuer(t: string): string | null {
  const labelled = t.match(/(?:certification body|certified by|issued by|independent (?:service )?auditor|audit(?:ed)? by|auditor|tested by|performed by)\s*[:-]?\s*([A-Z][^\n,;.]{2,80})/i);
  if (labelled) return labelled[1].trim().replace(/\s+/g, ' ');
  for (const n of KNOWN_ISSUERS) {
    if (new RegExp(`(^|[^A-Za-z])${n.replace(/[.*+?^${}()|[\]\\&]/g, '\\$&')}([^A-Za-z]|$)`).test(t)) return n;
  }
  return null;
}

const sentences = (t: string) => t.replace(/\r/g, '').split(/(?<=[.!?])\s+|\n{1,}/).map((s) => s.trim().replace(/\s+/g, ' ')).filter((s) => s.length > 3);
const clip = (s: string, n = 300) => (s.length > n ? `${s.slice(0, n - 1).trim()}…` : s);

function detectPeriod(t: string): { from: string | null; to: string | null } {
  for (const m of t.matchAll(/period|for the (?:period|year) (?:from|ended)|covering|throughout/gi)) {
    const d = datesIn(t.slice(m.index!, m.index! + 220));
    if (d.length >= 2) return { from: d[0], to: d[1] };
  }
  // A Type 1 report is "as of" one date.
  const asOf = t.match(/as of\s+([^\n]{0,40})/i);
  if (asOf) { const d = datesIn(asOf[1]); if (d.length) return { from: d[0], to: d[0] }; }
  return { from: null, to: null };
}

function detectExpiry(t: string): string | null {
  const m = t.match(/(valid until|valid to|expiry date|expiration date|date of expiry|expires(?: on)?|certificate expiry)\s*[:-]?\s*([^\n]{0,60})/i);
  if (!m) return null;
  return datesIn(m[2])[0] ?? null;
}

function detectExceptions(t: string): string[] {
  const hit = /\b(exceptions? (?:was |were )?noted|qualified opinion|qualified our opinion|except for the|deviations? (?:was |were )?(?:noted|identified)|(?:critical|high)[- ](?:risk|severity)? ?(?:findings?|vulnerabilit(?:y|ies)|issues?)\b[^.]*\b(?:open|remain|unresolved|outstanding))/i;
  const clean = /\bno (?:exceptions|deviations)\b|\bunqualified\b|\bwithout exception\b|\bno (?:open )?(?:critical|high)\b|\b(?:0|zero|none) (?:critical|high)/i;
  return [...new Set(sentences(t).filter((s) => hit.test(s) && !clean.test(s)).map((s) => clip(s)))].slice(0, 6);
}

const PLACES = ['South Africa', 'United States', 'USA', 'European Union', 'EU', 'European Economic Area', 'United Kingdom', 'Ireland', 'Germany', 'Netherlands', 'France', 'India', 'Singapore', 'Australia', 'Canada', 'Japan', 'Brazil', 'Frankfurt', 'Dublin', 'Cape Town', 'Johannesburg', 'London', 'Amsterdam'];

function detectLocations(t: string): string[] {
  const out = new Set<string>();
  for (const s of sentences(t)) {
    if (!/(stored|hosted|host|data cent(?:er|re)|region|located|processed|resid)/i.test(s)) continue;
    for (const p of PLACES) if (new RegExp(`\\b${p}\\b`).test(s)) out.add(p === 'USA' ? 'United States' : p === 'EU' ? 'European Union' : p);
  }
  return [...out].slice(0, 8);
}

function detectScope(t: string): string | null {
  const s = sentences(t).find((x) => /\bscope\b|\bapplicable to\b|\bcovers the\b|\bin respect of\b/i.test(x) && x.length > 25);
  return s ? clip(s) : null;
}

const fmt = (v: string) => new Date(`${v}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** The concerns AIC raises for any read, from the dates and the supplier's own details. */
export function standardConcerns(f: Omit<SupplierDocFindings, 'concerns' | 'suggestedOutcome' | 'suggestedNotes'>, supplier: SupplierContext, now = Date.now()): string[] {
  const out: string[] = [];
  const old = docOutOfDate(f, now);
  if (old === 'expired') out.push(`The document expired on ${fmt(f.expires!)}.`);
  if (old === 'stale' || (old === 'expired' && f.coversTo && docOutOfDate({ expires: null, coversTo: f.coversTo }, now)))
    out.push(`The period it covers ended on ${fmt(f.coversTo!)}, more than 12 months ago.`);
  if (f.exceptions.some((e) => /qualified/i.test(e) && !/unqualified/i.test(e))) out.push('The auditor gave a qualified opinion.');
  else if (f.exceptions.length) out.push(`It notes ${f.exceptions.length === 1 ? 'an exception or open finding' : 'exceptions or open findings'}; check whether they affect the service you use.`);
  const personal = supplier.dataShared.some((d) => d === 'personal' || d === 'special');
  if (personal && supplier.outsideSa && !supplier.hasDpa && f.kind !== 'dpa')
    out.push('They hold personal information outside South Africa and there are no data processing terms on file for it (POPIA s72).');
  return out;
}

function suggest(f: Omit<SupplierDocFindings, 'suggestedOutcome' | 'suggestedNotes'>): Pick<SupplierDocFindings, 'suggestedOutcome' | 'suggestedNotes'> {
  const what = `${DOC_KIND_LABEL[f.kind]}${f.issuer ? ` from ${f.issuer}` : ''}`;
  const when = f.coversFrom && f.coversTo && f.coversFrom !== f.coversTo ? ` covering ${fmt(f.coversFrom)} to ${fmt(f.coversTo)}` : f.expires ? ` valid until ${fmt(f.expires)}` : f.coversTo ? ` as of ${fmt(f.coversTo)}` : '';
  const parts = [`Read their ${what}${when}.`];
  if (f.concerns.length) parts.push(`Conditions: ${f.concerns.slice(0, 2).map((c) => c.replace(/\.$/, '').replace(/^./, (x) => x.toLowerCase())).join('; ')}.`);
  else if (f.kind === 'soc2_type2' || f.kind === 'soc2_type1') parts.push('No exceptions found in the text.');
  if (f.kind === 'other') return { suggestedOutcome: null, suggestedNotes: parts.join(' ') };
  const outcome = f.concerns.length ? 'approved_with_conditions' : (f.coversTo || f.expires) ? 'approved' : null;
  return { suggestedOutcome: outcome, suggestedNotes: parts.join(' ') };
}

/** The rule-based read: report type, dates, exception wording. No guessing beyond what the text says. */
export function readByRules(text: string, supplier: SupplierContext, now = Date.now()): SupplierDocFindings {
  const t = text.slice(0, MAX_TEXT);
  const period = detectPeriod(t);
  const base = {
    kind: detectKind(t), issuer: detectIssuer(t), coversFrom: period.from, coversTo: period.to, expires: detectExpiry(t),
    scope: detectScope(t), exceptions: detectExceptions(t), dataLocations: detectLocations(t), subprocessors: [] as string[],
    personalInformation: (/personal (information|data)|\bPOPIA\b|\bGDPR\b/i.test(t) ? 'mentioned' : 'not mentioned') as SupplierDocFindings['personalInformation'],
    readNote: null,
  };
  const withConcerns = { ...base, concerns: standardConcerns(base, supplier, now) };
  return { ...withConcerns, ...suggest(withConcerns) };
}

// ── Model ───────────────────────────────────────────────────────────────────

const SYSTEM = `You read a supplier's security document (a SOC 2 report, ISO 27001 certificate, penetration test summary, data processing agreement or security questionnaire answers) for a South African organisation that uses this supplier. A person reviews your read before deciding anything.

Rules:
- Quote only what the document says. Never guess or infer dates; if a date is not stated, use null.
- Dates as YYYY-MM-DD. "coversFrom"/"coversTo" are the audit or test period; "expires" is a certificate's expiry or validity end.
- "exceptions": exceptions noted by the auditor, a qualified opinion, or high or critical findings still open, each as a short quote or close paraphrase. Empty if none.
- "concerns": plain sentences for: the document has expired; the period ended more than 12 months before today; the scope does not cover the service the organisation uses; a qualified opinion; no data processing terms for personal information leaving South Africa. Empty if none apply.
- "suggestedOutcome": "approved", "approved_with_conditions", "rejected" or null if you cannot tell.
- "suggestedNotes": two or three plain sentences a reviewer can edit: what was read, what it covers, and any conditions.
- Use null or empty lists when the document does not say.

Reply with JSON only:
{"kind": "soc2_type2|soc2_type1|iso27001|pentest|dpa|questionnaire|other", "issuer": "<auditor or certification body, or null>", "coversFrom": null, "coversTo": null, "expires": null, "scope": "<one sentence, or null>", "exceptions": [], "dataLocations": [], "subprocessors": [], "personalInformation": "mentioned|not mentioned", "concerns": [], "suggestedOutcome": null, "suggestedNotes": ""}`;

const strs = (v: unknown, n: number, len = 300) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()).slice(0, n).map((x) => clip(x.trim(), len)) : []);

/** Validates a model reply into findings, then adds AIC's own date and DPA concerns. */
export function cleanAiFindings(r: Record<string, unknown>, supplier: SupplierContext, now = Date.now()): SupplierDocFindings {
  const base = {
    kind: (DOC_KINDS.includes(r.kind as SupplierDocKind) ? r.kind : 'other') as SupplierDocKind,
    issuer: typeof r.issuer === 'string' && r.issuer.trim() ? clip(r.issuer.trim(), 120) : null,
    coversFrom: isoOrNull(r.coversFrom), coversTo: isoOrNull(r.coversTo), expires: isoOrNull(r.expires),
    scope: typeof r.scope === 'string' && r.scope.trim() ? clip(r.scope.trim(), 400) : null,
    exceptions: strs(r.exceptions, 8), dataLocations: strs(r.dataLocations, 10, 80), subprocessors: strs(r.subprocessors, 30, 120),
    personalInformation: (r.personalInformation === 'mentioned' ? 'mentioned' : 'not mentioned') as SupplierDocFindings['personalInformation'],
    readNote: null,
  };
  const own = standardConcerns(base, supplier, now);
  const theirs = strs(r.concerns, 6);
  const concerns = [...own, ...theirs.filter((c) => !own.some((o) => o.slice(0, 20).toLowerCase() === c.slice(0, 20).toLowerCase()))].slice(0, 8);
  const outcomes = ['approved', 'approved_with_conditions', 'rejected'] as const;
  let suggestedOutcome = outcomes.includes(r.suggestedOutcome as never) ? (r.suggestedOutcome as SupplierDocFindings['suggestedOutcome']) : null;
  if (suggestedOutcome === 'approved' && own.length) suggestedOutcome = 'approved_with_conditions';
  const notes = typeof r.suggestedNotes === 'string' && r.suggestedNotes.trim() ? clip(r.suggestedNotes.trim(), 1000) : '';
  const f = { ...base, concerns, suggestedOutcome, suggestedNotes: notes };
  return notes ? f : { ...f, suggestedNotes: suggest(f).suggestedNotes };
}

/**
 * Reads one supplier document. `text` is the extracted text (empty for a PDF,
 * which goes to the model as `pdf`). Falls back to the rules when the model is
 * off or fails; a PDF with no model gets a clear note instead of a guess.
 */
export async function readSupplierDocument(opts: { text: string; fileName: string; supplier: SupplierContext; pdf?: Buffer; now?: number }): Promise<{ findings: SupplierDocFindings; readBy: 'ai' | 'rules' }> {
  const now = opts.now ?? Date.now();
  const text = (opts.text ?? '').slice(0, MAX_TEXT);
  if (aiConfigured() && (text.trim() || opts.pdf)) {
    const doc: ContentBlock = opts.pdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: opts.pdf.toString('base64') } }
      : { type: 'text', text: `Contents of ${opts.fileName}:\n${text}` };
    const s = opts.supplier;
    try {
      const r = await askJson<Record<string, unknown>>({
        system: SYSTEM,
        content: [
          { type: 'text', text: `Today is ${new Date(now).toISOString().slice(0, 10)}.\nSupplier: ${s.name}\nWhat they do for the organisation: ${s.purpose || 'not stated'}\nData they hold: ${s.dataShared.join(', ') || 'not stated'}\nData outside South Africa: ${s.outsideSa ? 'yes' : 'no'}\nSigned data processing agreement on file: ${s.hasDpa ? 'yes' : 'no'}\nFile name: ${opts.fileName}` },
          doc,
        ],
        maxTokens: 1500,
        timeoutMs: 60_000,
      });
      return { findings: cleanAiFindings(r, s, now), readBy: 'ai' };
    } catch (e) {
      console.error('[SUPPLIER_DOC_AI]', e instanceof Error ? e.message : e);
    }
  }
  if (opts.pdf && !text.trim()) {
    const base = { kind: detectKind(opts.fileName), issuer: null, coversFrom: null, coversTo: null, expires: null, scope: null, exceptions: [], dataLocations: [], subprocessors: [], personalInformation: 'not mentioned' as const, readNote: PDF_NEEDS_AI };
    const concerns = standardConcerns(base, opts.supplier, now);
    return { findings: { ...base, concerns, suggestedOutcome: null, suggestedNotes: '' }, readBy: 'rules' };
  }
  return { findings: readByRules(text, opts.supplier, now), readBy: 'rules' };
}
