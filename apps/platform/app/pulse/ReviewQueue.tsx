'use client';

import { useCallback, useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { OverridePanel } from './OverridePanel';
import { outcomeOptions, reasonOptions } from '@/lib/override';

type Pending = {
  id: string; systemName: string; inputParams: unknown; outcome: unknown; explanation: string | null;
  createdAt: string; reviewDueAt: string | null; externalRef: string | null;
};

const show = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v, null, 2));
function due(iso: string | null) {
  if (!iso) return '';
  const h = Math.round((new Date(iso).getTime() - Date.now()) / 3_600_000);
  return h <= 0 ? 'due now' : h < 48 ? `due in ${h} h` : `due in ${Math.round(h / 24)} days`;
}

export type HistoryRow = { systemName: string; outcome: unknown; isHumanOverride?: boolean | null; overrideReason?: string | null; finalOutcome?: unknown };

function Card({ d, history, onDone }: { d: Pending; history: HistoryRow[]; onDone: () => void }) {
  const [mode, setMode] = useState<'idle' | 'override'>('idle');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function send(action: 'approve') {
    setBusy(true); setErr('');
    const r = await fetch(`/api/decisions/${d.id}/review`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, note }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error ?? 'Could not record the review.'); return; }
    onDone();
  }

  return (
    <li className="rounded-xl border border-[#dde2e8] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold text-[#0e1b2c]">{d.systemName}{d.externalRef ? <span className="font-normal text-[#8a95a3]"> · {d.externalRef}</span> : null}</div>
        <span className="inline-flex items-center gap-1 text-[12px] text-[#b45309]"><Clock className="h-3.5 w-3.5" />{due(d.reviewDueAt)}</span>
      </div>
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className="text-[12px] font-medium text-[#8a6a1f]">What the system was given</div>
          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-[#f5f7f9] p-3 text-[12px] leading-relaxed text-[#0e1b2c]">{show(d.inputParams)}</pre>
        </div>
        <div>
          <div className="text-[12px] font-medium text-[#8a6a1f]">What it decided</div>
          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-[#f5f7f9] p-3 text-[12px] leading-relaxed text-[#0e1b2c]">{show(d.outcome)}</pre>
          {d.explanation && <p className="mt-2 text-[13px] leading-relaxed text-[#5e6b7b]">{d.explanation}</p>}
        </div>
      </div>
      {mode === 'override' ? (
        <div className="mt-4">
          <OverridePanel id={d.id} original={d.outcome} outcomes={outcomeOptions(history, d.systemName, d.outcome)} reasons={reasonOptions(history, d.systemName)}
            onDone={onDone} onCancel={() => setMode('idle')} />
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="h-10 min-w-0 flex-1 rounded-full border border-[#dde2e8] bg-white px-4 text-[13px] outline-none focus:border-[#a8772a]" />
          <button onClick={() => send('approve')} disabled={busy} className="inline-flex h-10 items-center rounded-full bg-[#0e1b2c] px-4 text-[13px] font-medium text-white hover:bg-[#22344a] disabled:opacity-40">Approve</button>
          <button onClick={() => setMode('override')} disabled={busy} className="inline-flex h-10 items-center rounded-full border border-[#dde2e8] bg-white px-4 text-[13px] font-medium text-[#0e1b2c] hover:border-[#a8772a]">Override</button>
        </div>
      )}
      {err && <p className="mt-2 text-[13px] text-[#b42318]">{err}</p>}
    </li>
  );
}

/** Decisions a system has asked a person to approve before it acts. */
export function ReviewQueue({ onChange, history = [] }: { onChange?: () => void; history?: HistoryRow[] }) {
  const [rows, setRows] = useState<Pending[] | null>(null);
  const load = useCallback(() => {
    fetch('/api/decisions?review=pending', { cache: 'no-store' }).then((r) => r.json()).then((d) => setRows(d.decisions ?? [])).catch(() => setRows([]));
  }, []);
  useEffect(load, [load]);
  if (!rows || rows.length === 0) return null;
  return (
    <section>
      <h2 className="text-base font-semibold text-[#0e1b2c]">Waiting for a person <span className="ml-1 rounded-full bg-[#b45309]/10 px-2 py-0.5 text-[12px] font-medium text-[#b45309]">{rows.length}</span></h2>
      <p className="mt-1 mb-3 text-[13px] text-[#5e6b7b]">Your systems have held these decisions until someone approves or overrides them. Each review is recorded with your name and sent back to the system.</p>
      <ul className="space-y-3">{rows.map((d) => <Card key={d.id} d={d} history={history} onDone={() => { load(); onChange?.(); }} />)}</ul>
    </section>
  );
}
