'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Paperclip, Clock } from 'lucide-react';
import { PageHeader } from '@/app/components/ui/PageHeader';

/**
 * Findings an AIC assessor has raised, and the organisation's response to
 * each. Only real findings appear: this page used to list every requirement
 * of the standard as a "finding" with a guessed severity, which told a client
 * they had forty problems nobody had raised.
 */

type Finding = {
  id: string; severity: 'MAJOR' | 'MINOR' | 'OBSERVATION' | 'ETHICAL_CONCERN'; title: string; description: string;
  status: 'OPEN' | 'RESPONSE_SUBMITTED' | 'ACCEPTED' | 'CLOSED' | 'WITHDRAWN';
  raisedAt: string; dueAt: string | null; closedAt: string | null; closureNotes: string | null;
  requirementTitle: string | null; documentTitle: string | null;
};
type Action = { id: string; rootCause: string | null; actionTaken: string; submittedAt: string; outcome: string | null; reviewNotes: string | null; reviewedAt: string | null };

const SEVERITY: Record<Finding['severity'], { label: string; tone: string }> = {
  MAJOR: { label: 'Major', tone: 'bg-[#b23a35]/10 text-[#b23a35]' },
  ETHICAL_CONCERN: { label: 'Ethical concern', tone: 'bg-[#b23a35]/10 text-[#b23a35]' },
  MINOR: { label: 'Minor', tone: 'bg-[#b45309]/10 text-[#b45309]' },
  OBSERVATION: { label: 'Observation', tone: 'bg-[#eef1f5] text-[#5e6b7b]' },
};
const STATUS: Record<Finding['status'], string> = {
  OPEN: 'Waiting for your response', RESPONSE_SUBMITTED: 'Response with the assessor', ACCEPTED: 'Response accepted',
  CLOSED: 'Closed', WITHDRAWN: 'Withdrawn by the assessor',
};
const OUTCOME: Record<string, string> = { ACCEPTED: 'Accepted', REJECTED: 'Not accepted', MORE_INFO_REQUIRED: 'More needed' };
const date = (v: string | null) => (v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
const isOpen = (f: Finding) => f.status === 'OPEN' || f.status === 'RESPONSE_SUBMITTED';

function Respond({ finding, onDone }: { finding: Finding; onDone: () => void }) {
  const [root, setRoot] = useState('');
  const [action, setAction] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  async function send() {
    setBusy(true); setErr('');
    let evidenceDocumentId: string | undefined;
    if (file) {
      const fd = new FormData(); fd.append('file', file); fd.append('slotType', 'FINDING_RESPONSE');
      const u = await fetch('/api/v1/vault/upload', { method: 'POST', body: fd });
      const uj = await u.json().catch(() => ({}));
      if (!u.ok) { setBusy(false); setErr(uj.error ?? 'The file could not be filed.'); return; }
      evidenceDocumentId = uj.document?.id;
    }
    const r = await fetch(`/api/v1/findings/${finding.id}/corrective-actions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rootCause: root.trim() || undefined, actionTaken: action.trim(), evidenceDocumentId }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error ?? 'Could not send your response.'); return; }
    onDone();
  }
  return (
    <div className="space-y-3 rounded-xl border border-[#dde2e8] bg-[#fbfcfd] p-4">
      <label className="block text-[13px] font-medium text-[#0e1b2c]">Why it happened <span className="font-normal text-[#8a95a3]">(optional)</span>
        <textarea value={root} onChange={(e) => setRoot(e.target.value)} rows={2} className="mt-1 w-full rounded-xl border border-[#dde2e8] bg-white px-3 py-2 text-[14px] font-normal outline-none focus:border-[#a8772a]" />
      </label>
      <label className="block text-[13px] font-medium text-[#0e1b2c]">What you have done about it
        <textarea value={action} onChange={(e) => setAction(e.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-[#dde2e8] bg-white px-3 py-2 text-[14px] font-normal outline-none focus:border-[#a8772a]" />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input ref={ref} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button type="button" onClick={() => ref.current?.click()} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-[#dde2e8] bg-white px-4 text-[13px] font-medium text-[#0e1b2c] hover:border-[#a8772a]"><Paperclip className="h-4 w-4" />{file ? file.name : 'Attach evidence'}</button>
        <button type="button" onClick={send} disabled={busy || action.trim().length < 10} className="inline-flex h-10 items-center rounded-full bg-[#0e1b2c] px-4 text-[13px] font-medium text-white hover:bg-[#22344a] disabled:opacity-40">{busy ? 'Sending…' : 'Send to the assessor'}</button>
        {action.trim().length > 0 && action.trim().length < 10 && <span className="text-[12.5px] text-[#8a95a3]">A sentence or two, at least.</span>}
      </div>
      {err && <p className="text-[13px] text-[#b42318]">{err}</p>}
    </div>
  );
}

function FindingRow({ f, onChange }: { f: Finding; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [actions, setActions] = useState<Action[] | null>(null);
  const overdue = isOpen(f) && f.dueAt && new Date(f.dueAt).getTime() < Date.now();
  useEffect(() => {
    if (!open || actions) return;
    fetch(`/api/v1/findings/${f.id}/corrective-actions`).then((r) => r.json()).then((j) => setActions(j.correctiveActions ?? [])).catch(() => setActions([]));
  }, [open, actions, f.id]);
  const s = SEVERITY[f.severity] ?? SEVERITY.OBSERVATION;
  return (
    <li className="rounded-xl border border-[#dde2e8] bg-white">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-start gap-4 px-4 py-4 text-left sm:px-5">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-medium ${s.tone}`}>{s.label}</span>
            <span className="text-[12.5px] text-[#5e6b7b]">{STATUS[f.status]}</span>
          </span>
          <span className="mt-1.5 block text-[15px] font-semibold text-[#0e1b2c]">{f.title}</span>
          {f.requirementTitle && <span className="mt-0.5 block truncate text-[13px] text-[#5e6b7b]">Against: {f.requirementTitle}</span>}
        </span>
        <span className="shrink-0 text-right text-[12.5px]">
          {f.dueAt && isOpen(f) && <span className={`flex items-center justify-end gap-1 ${overdue ? 'font-medium text-[#b23a35]' : 'text-[#5e6b7b]'}`}><Clock className="h-3.5 w-3.5" />{overdue ? 'Overdue since' : 'Due'} {date(f.dueAt)}</span>}
          {!isOpen(f) && f.closedAt && <span className="text-[#8a95a3]">Closed {date(f.closedAt)}</span>}
          <ChevronDown className={`ml-auto mt-2 h-4 w-4 text-[#8a95a3] transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && (
        <div className="space-y-4 border-t border-[#eef1f5] px-4 pb-5 pt-4 sm:px-5">
          <p className="whitespace-pre-line text-[14px] leading-relaxed text-[#0e1b2c]">{f.description}</p>
          <p className="text-[12.5px] text-[#8a95a3]">Raised {date(f.raisedAt)}{f.documentTitle ? `, on the file ${f.documentTitle}` : ''}.</p>
          {f.closureNotes && <p className="rounded-xl bg-[#f5f7f9] px-4 py-3 text-[13px] text-[#0e1b2c]"><span className="font-medium">Assessor’s closing note:</span> {f.closureNotes}</p>}
          {actions && actions.length > 0 && (
            <ol className="space-y-2">
              {actions.map((a) => (
                <li key={a.id} className="rounded-xl border border-[#eef1f5] px-4 py-3 text-[13px]">
                  <p className="text-[#8a95a3]">Your response, {date(a.submittedAt)}{a.outcome ? `: ${OUTCOME[a.outcome] ?? a.outcome}` : ', waiting for the assessor'}</p>
                  {a.rootCause && <p className="mt-1 text-[#5e6b7b]"><span className="font-medium text-[#0e1b2c]">Why:</span> {a.rootCause}</p>}
                  <p className="mt-1 text-[#0e1b2c]">{a.actionTaken}</p>
                  {a.reviewNotes && <p className="mt-2 text-[#5e6b7b]"><span className="font-medium text-[#0e1b2c]">Assessor:</span> {a.reviewNotes}</p>}
                </li>
              ))}
            </ol>
          )}
          {f.status === 'OPEN' && <Respond finding={f} onDone={() => { setActions(null); onChange(); }} />}
        </div>
      )}
    </li>
  );
}

export default function AuditorFindings() {
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [error, setError] = useState('');
  const [view, setView] = useState<'open' | 'all'>('open');
  const load = useCallback(() => {
    fetch('/api/v1/findings', { cache: 'no-store' })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setFindings(j.findings ?? []); })
      .catch((e) => setError(e.message || 'Could not load findings.'));
  }, []);
  useEffect(load, [load]);

  const counts = useMemo(() => {
    const f = findings ?? [];
    return { open: f.filter(isOpen).length, waiting: f.filter((x) => x.status === 'OPEN').length, overdue: f.filter((x) => isOpen(x) && x.dueAt && new Date(x.dueAt).getTime() < Date.now()).length, all: f.length };
  }, [findings]);
  const shown = (findings ?? []).filter((f) => view === 'all' || isOpen(f));

  return (
    <div>
      <PageHeader eyebrow="Compliance tracking" title="Assessor findings" lede="What your AIC assessor has raised, and your response to each. A finding closes when the assessor accepts what you did about it." />
      {error && <p className="text-sm text-[#b42318]">{error}</p>}
      {!findings && !error && <p className="text-sm text-[#5e6b7b]">Loading…</p>}
      {findings && findings.length === 0 && (
        <div className="rounded-xl border border-[#dde2e8] bg-white p-6">
          <p className="text-[15px] font-medium text-[#0e1b2c]">No findings have been raised.</p>
          <p className="mt-1 text-[14px] text-[#5e6b7b]">When an assessor reviews your evidence and raises something, it appears here with a due date, and you respond from this page.</p>
        </div>
      )}
      {findings && findings.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[15px] text-[#0e1b2c]">
              <span className="font-semibold">{counts.open} open</span>{counts.waiting ? `, ${counts.waiting} waiting for your response` : ''}{counts.overdue ? <span className="text-[#b23a35]">, {counts.overdue} overdue</span> : null}.
            </p>
            <div className="inline-flex self-start rounded-full border border-[#dde2e8] bg-white p-1">
              {([['open', 'Open'], ['all', 'Everything']] as const).map(([k, l]) => (
                <button key={k} onClick={() => setView(k)} className={`h-9 rounded-full px-4 text-sm font-medium ${view === k ? 'bg-[#0e1b2c] text-white' : 'text-[#5e6b7b] hover:text-[#0e1b2c]'}`}>{l} <span className="opacity-60">{k === 'open' ? counts.open : counts.all}</span></button>
              ))}
            </div>
          </div>
          {shown.length === 0 ? <p className="rounded-xl border border-[#dde2e8] bg-white px-4 py-5 text-[14px] text-[#2e7a57]">Nothing open. Every finding has been closed.</p> : (
            <ul className="space-y-3">{shown.map((f) => <FindingRow key={f.id} f={f} onChange={load} />)}</ul>
          )}
        </div>
      )}
    </div>
  );
}
