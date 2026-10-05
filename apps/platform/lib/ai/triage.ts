/**
 * A first read of an uploaded document, before the assessor sees it.
 *
 * The model is told what the evidence is meant to show (the requirement's
 * guidance, or the common control's "good evidence" line) and says whether the
 * document looks like it, what it is, and what seems to be missing. The
 * person filing it sees that at once and can file something better; the
 * assessor sees it as a note. It is never the assessor's decision and never
 * changes a document's status.
 */
import { askJson, aiConfigured, aiModel, type ContentBlock } from './claude';
import { docxText } from './docx-text';

export type { Triage } from './triage-shared';
import type { Triage } from './triage-shared';

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_TEXT = 60_000;

const IMAGE: Record<string, 'image/png' | 'image/jpeg' | 'image/webp'> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
const TEXT = new Set(['txt', 'md', 'csv', 'json']);

/** The file as something the model can read, or null when it cannot (xlsx, pptx, zip, too large). */
export function documentContent(name: string, buf: Buffer): ContentBlock | null {
  if (buf.length > MAX_BYTES) return null;
  const ext = (name.split('.').pop() ?? '').toLowerCase();
  if (ext === 'pdf') return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buf.toString('base64') } };
  if (IMAGE[ext]) return { type: 'image', source: { type: 'base64', media_type: IMAGE[ext], data: buf.toString('base64') } };
  if (TEXT.has(ext)) return { type: 'text', text: `Contents of ${name}:\n${buf.toString('utf8').slice(0, MAX_TEXT)}` };
  if (ext === 'docx') {
    const t = docxText(buf);
    return t ? { type: 'text', text: `Contents of ${name}:\n${t.slice(0, MAX_TEXT)}` } : null;
  }
  return null;
}

const SYSTEM = `You give a first read of a document an organisation has filed as compliance evidence, before a human assessor reviews it.

You are told what the evidence is meant to show. Judge only whether this document looks like that evidence:
- "looks_right": it appears to be the kind of evidence asked for and covers the main points.
- "partly": relevant, but something the guidance asks for seems to be missing, out of date or unsigned.
- "not_relevant": it does not appear to be evidence of this at all.
- "unreadable": you cannot read enough of it to say.

Be specific and brief. Do not judge whether the organisation is compliant; that is the assessor's job. Never invent content that is not in the document.

Reply with JSON only: {"verdict": "...", "summary": "<one or two sentences: what the document is>", "missing": ["<up to 3 specific things the guidance asks for that you could not find>"], "documentDate": "<YYYY-MM-DD the document is dated, or null>"}`;

export async function triageDocument(opts: { fileName: string; buf: Buffer; purpose: string; guidance: string | null }): Promise<Triage | null> {
  if (!aiConfigured()) return null;
  const doc = documentContent(opts.fileName, opts.buf);
  if (!doc) return null;
  try {
    const r = await askJson<Partial<Triage>>({
      system: SYSTEM,
      content: [
        { type: 'text', text: `This document is filed as evidence for: ${opts.purpose}\n${opts.guidance ? `What good evidence looks like: ${opts.guidance}\n` : ''}File name: ${opts.fileName}` },
        doc,
      ],
      maxTokens: 500,
      timeoutMs: 40_000,
    });
    const verdicts = ['looks_right', 'partly', 'not_relevant', 'unreadable'] as const;
    return {
      verdict: verdicts.includes(r.verdict as Triage['verdict']) ? (r.verdict as Triage['verdict']) : 'unreadable',
      summary: String(r.summary ?? '').slice(0, 400),
      missing: Array.isArray(r.missing) ? r.missing.filter((m): m is string => typeof m === 'string').slice(0, 3).map((m) => m.slice(0, 200)) : [],
      documentDate: typeof r.documentDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.documentDate) ? r.documentDate : null,
      model: aiModel(),
      at: new Date().toISOString(),
    };
  } catch (e) {
    console.error('[TRIAGE_AI]', e instanceof Error ? e.message : e);
    return null;
  }
}

export { parseTriage } from './triage-shared';
