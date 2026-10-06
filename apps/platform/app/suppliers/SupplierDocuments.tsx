'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Sparkles, Upload } from 'lucide-react';
import { DOC_KIND_LABEL, docOutOfDate, type SupplierDocFindings } from '@/lib/registers/suppliers';

type Read = { id: string; fileName: string; findings: SupplierDocFindings; readBy: 'ai' | 'rules'; documentId: string | null; createdAt: string };

const day = (v: string | null) => (v ? new Date(v + (v.length === 10 ? 'T00:00:00Z' : '')).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : null);

/**
 * A supplier's security documents and AIC's first read of each. "Use this in
 * the review" only pre-fills the review form; a person still decides.
 */
export function SupplierDocuments({ supplierId, canManage, onUse }: { supplierId: string; canManage: boolean; onUse: (outcome: string, notes: string) => void }) {
  const [reads, setReads] = useState<Read[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    fetch(`/api/suppliers/${supplierId}/documents`, { cache: 'no-store' }).then(async (r) => {
      const j = await r.json().catch(() => ({}));
      if (r.ok) setReads(j.reads); else { setReads([]); if (r.status !== 404) setErr(j.error ?? ''); }
    });
  }, [supplierId]);
  useEffect(load, [load]);

  async function upload(file: File) {
    setBusy(true); setErr('');
    const fd = new FormData(); fd.append('file', file);
    const r = await fetch(`/api/suppliers/${supplierId}/documents`, { method: 'POST', body: fd });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
    if (!r.ok) { setErr(j.error ?? 'Could not read the document.'); return; }
    load();
  }

  return (
    <section className="rounded-xl border border-[#dde2e8] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-[15px] font-semibold text-[#0e1b2c]">Their security documents</h3>
          <p className="mt-0.5 text-[13px] text-[#5e6b7b]">A SOC 2 report, ISO 27001 certificate, penetration test summary or data processing agreement. AIC reads it first and suggests what the review should say.</p>
        </div>
        {canManage && (
          <label className={`inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full border border-[#dde2e8] px-4 text-[14px] font-medium text-[#0e1b2c] hover:border-[#a8772a] ${busy ? 'pointer-events-none opacity-50' : ''}`}>
            <Upload className="h-4 w-4" />{busy ? 'Reading…' : 'Add a document'}
            <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
        )}
      </div>
      {err && <p className="mt-2 text-[13px] text-[#b23a35]">{err}</p>}
      {reads && reads.length === 0 && <p className="mt-3 text-[13px] text-[#8a95a3]">None added yet.</p>}
      <ul className="mt-3 space-y-3">
        {(reads ?? []).map((r) => {
          const f = r.findings;
          const old = docOutOfDate(f);
          const period = f.coversFrom || f.coversTo ? `covers ${day(f.coversFrom) ?? '?'} to ${day(f.coversTo) ?? '?'}` : null;
          return (
            <li key={r.id} className="rounded-lg bg-[#f5f7f9] p-3.5 text-[13.5px]">
              <p className="flex items-start gap-2 font-medium text-[#0e1b2c]"><FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#8a95a3]" />{DOC_KIND_LABEL[f.kind] ?? 'Document'}<span className="font-normal text-[#8a95a3]">{r.fileName}</span></p>
              <p className="mt-1 text-[#5e6b7b]">{[f.issuer ? `Issued by ${f.issuer}` : null, period, f.expires ? `${old === 'expired' ? 'expired' : 'valid until'} ${day(f.expires)}` : null].filter(Boolean).join(', ') || 'No issuer or dates found.'}</p>
              {f.scope && <p className="mt-1 text-[#5e6b7b]">Scope: {f.scope}</p>}
              {f.exceptions.length > 0 && <div className="mt-1.5"><p className="text-[#b23a35]">Exceptions noted:</p><ul className="ml-4 list-disc text-[#8f2d29]">{f.exceptions.map((x) => <li key={x}>{x}</li>)}</ul></div>}
              {f.concerns.length > 0 && <ul className="mt-1.5 space-y-0.5 text-[#b45309]">{f.concerns.map((x) => <li key={x}>{x}</li>)}</ul>}
              {f.readNote && <p className="mt-1.5 text-[#8a95a3]">{f.readNote}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1 text-[12px] text-[#8a6a1f]"><Sparkles className="h-3.5 w-3.5" />First read by AIC{r.readBy === 'rules' ? ' (without its AI service)' : ''}; check it before relying on it</span>
                {canManage && (f.suggestedOutcome || f.suggestedNotes) && <button type="button" onClick={() => onUse(f.suggestedOutcome ?? '', f.suggestedNotes)} className="text-[13px] font-medium text-[#0e1b2c] underline decoration-[#a8772a] underline-offset-2">Use this in the review</button>}
                {r.documentId && <a href={`/api/evidence/${r.documentId}/file`} className="text-[13px] text-[#5e6b7b] hover:text-[#0e1b2c]">Download</a>}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
