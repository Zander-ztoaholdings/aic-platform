'use client';

import { useState } from 'react';
import { outcomeLabel, composeNote, shapeOutcome, OTHER_REASON } from '@/lib/override';

/**
 * Two taps to record an override: what it became, and why. Everything else
 * (the system, what it decided, who you are, when) AIC already knows.
 */
export function OverridePanel({ id, original, outcomes, reasons, onDone, onCancel }: {
  id: string;
  original: unknown;
  outcomes: string[];
  reasons: string[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [outcome, setOutcome] = useState<string | null>(outcomes.length === 1 ? outcomes[0] : null);
  const [custom, setCustom] = useState('');
  const [reason, setReason] = useState<string | null>(null);
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const chosen = outcome === OTHER_REASON ? custom.trim() : outcome;
  const was = outcomeLabel(original);

  async function save() {
    setErr('');
    if (!chosen) { setErr('Choose what the outcome is now.'); return; }
    const n = composeNote(reason, detail);
    if ('error' in n) { setErr(n.error); return; }
    setBusy(true);
    const r = await fetch(`/api/decisions/${id}/review`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'override', note: n.note, outcome: shapeOutcome(original, chosen) }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error ?? 'Could not record the override.'); return; }
    onDone();
  }

  const chip = (on: boolean) =>
    `inline-flex min-h-[40px] items-center rounded-full border px-3.5 text-[13px] font-medium transition-colors ${on ? 'border-[#0e1b2c] bg-[#0e1b2c] text-white' : 'border-[#dde2e8] bg-white text-[#0e1b2c] hover:border-[#a8772a]'}`;

  return (
    <div className="space-y-4 rounded-xl border border-[#a8772a]/30 bg-[#a8772a]/[0.04] p-4">
      <div>
        <p className="text-[13px] font-semibold text-[#0e1b2c]">Change {was ? <>&ldquo;{was}&rdquo; </> : ''}to</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {outcomes.map((o) => <button key={o} type="button" onClick={() => setOutcome(o)} className={chip(outcome === o)}>{o}</button>)}
          <button type="button" onClick={() => setOutcome(OTHER_REASON)} className={chip(outcome === OTHER_REASON)}>{outcomes.length ? 'Something else' : 'Type the new outcome'}</button>
        </div>
        {outcome === OTHER_REASON && (
          <input autoFocus value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={200} placeholder="e.g. approved with a lower limit"
            className="mt-2 h-11 w-full rounded-xl border border-[#dde2e8] bg-white px-3.5 text-[15px] outline-none focus:border-[#a8772a]" />
        )}
      </div>
      <div>
        <p className="text-[13px] font-semibold text-[#0e1b2c]">Because</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {reasons.map((r) => <button key={r} type="button" onClick={() => setReason(r)} className={chip(reason === r)}>{r}</button>)}
          <button type="button" onClick={() => setReason(OTHER_REASON)} className={chip(reason === OTHER_REASON)}>{OTHER_REASON}</button>
        </div>
        <input value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={500}
          placeholder={reason === OTHER_REASON ? 'Why, in a few words (required)' : 'Add detail (optional)'}
          className="mt-2 h-11 w-full rounded-xl border border-[#dde2e8] bg-white px-3.5 text-[15px] outline-none focus:border-[#a8772a]" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={save} disabled={busy} className="inline-flex h-11 items-center rounded-full bg-[#0e1b2c] px-5 text-sm font-medium text-white hover:bg-[#22344a] disabled:opacity-40">{busy ? 'Recording…' : 'Record override'}</button>
        <button type="button" onClick={onCancel} disabled={busy} className="inline-flex h-11 items-center rounded-full px-4 text-sm font-medium text-[#5e6b7b] hover:text-[#0e1b2c]">Cancel</button>
        <span className="text-[12px] text-[#8a95a3]">Recorded with your name and the time.</span>
      </div>
      {err && <p className="text-[13px] text-[#b42318]">{err}</p>}
    </div>
  );
}
