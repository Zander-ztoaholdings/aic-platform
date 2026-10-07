'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, ShieldAlert, X } from 'lucide-react';
import { Portal } from '@/app/components/ui/Portal';

type PlanItem = { id: string; label: string; detail: string; skip: string | null };
type Preview = { plan: PlanItem[]; count: number; phrase: string | null; needsPassword: boolean };

/**
 * The bar that appears when rows are selected, and the dialog that carries
 * out a bulk action: a preview of exactly what will happen to each item
 * first, a reason always, and for anything that cannot be undone the typed
 * phrase and the person's own password.
 */
export function BulkBar({ kind, selected, actions, onClear, onDone }: {
  kind: 'organizations' | 'users';
  selected: string[];
  actions: { key: string; label: string; danger?: boolean }[];
  onClear: () => void;
  onDone: (message: string) => void;
}) {
  const [action, setAction] = useState<{ key: string; label: string; danger?: boolean } | null>(null);
  if (!selected.length) return null;
  const noun = kind === 'organizations' ? (selected.length === 1 ? 'organisation' : 'organisations') : (selected.length === 1 ? 'account' : 'accounts');
  return (
    <>
      <div className="sticky bottom-4 z-30 mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[#dde2e8] bg-white px-4 py-3 shadow-[0_12px_30px_-14px_rgba(14,27,44,0.35)]">
        <span className="mr-2 text-[14px] font-medium text-[#0e1b2c]">{selected.length} {noun} selected</span>
        {actions.map((a) => (
          <button key={a.key} type="button" onClick={() => setAction(a)}
            className={`h-9 rounded-full px-3.5 text-[13px] font-medium ${a.danger ? 'border border-[#b23a35]/40 text-[#b23a35] hover:bg-[#b23a35]/[0.06]' : 'border border-[#dde2e8] text-[#0e1b2c] hover:border-[#a8772a]'}`}>{a.label}</button>
        ))}
        <button type="button" onClick={onClear} className="ml-auto h-9 rounded-full px-3 text-[13px] text-[#5e6b7b] hover:text-[#0e1b2c]">Clear the selection</button>
      </div>
      {action && <BulkDialog kind={kind} ids={selected} action={action} onClose={() => setAction(null)} onDone={(m) => { setAction(null); onDone(m); }} />}
    </>
  );
}

function BulkDialog({ kind, ids, action, onClose, onDone }: {
  kind: 'organizations' | 'users'; ids: string[]; action: { key: string; label: string; danger?: boolean };
  onClose: () => void; onDone: (message: string) => void;
}) {
  const [p, setP] = useState<Preview | null>(null);
  const [err, setErr] = useState('');
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/v1/admin/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, action: action.key, ids, preview: true }) })
      .then(async (r) => { const j = await r.json().catch(() => ({})); if (r.ok) setP(j); else setErr(j.error ?? 'Could not prepare this.'); });
  }, [kind, action.key, ids]);

  const ready = !!p && p.count > 0 && reason.trim().length >= 3 && (!p.phrase || (confirm.trim().toLowerCase() === p.phrase && password.length > 0));

  async function run() {
    setBusy(true); setErr('');
    const r = await fetch('/api/v1/admin/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, action: action.key, ids, reason, confirm, password }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error ?? 'It did not go through.'); setPassword(''); return; }
    const parts = [`${j.done} done`, j.skipped ? `${j.skipped} skipped` : null, j.failed?.length ? `${j.failed.length} refused by the database (${j.failed.map((f: { label: string }) => f.label).join(', ')})` : null].filter(Boolean);
    onDone(`${action.label}: ${parts.join(', ')}.`);
  }

  const skipped = p?.plan.filter((i) => i.skip) ?? [];
  const doing = p?.plan.filter((i) => !i.skip) ?? [];
  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={action.label}>
        <div className="absolute inset-0 bg-[#0a1728]/40" onClick={busy ? undefined : onClose} />
        <div className="relative flex max-h-[92vh] w-full max-w-xl flex-col rounded-t-2xl bg-white sm:rounded-2xl">
          <div className="flex items-center justify-between border-b border-[#eef1f5] px-5 py-4">
            <h2 className={`flex items-center gap-2 font-serif text-[20px] font-semibold ${action.danger ? 'text-[#8f2d29]' : 'text-[#0e1b2c]'}`}>{action.danger && <ShieldAlert className="h-5 w-5" />}{action.label}</h2>
            <button type="button" onClick={onClose} disabled={busy} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eef1f5]" aria-label="Close"><X className="h-4 w-4" /></button>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-[14px] text-[#2b3a4d]">
            {!p && !err && <p className="text-[#5e6b7b]">Working out what this will do…</p>}
            {p && (
              <>
                {action.danger && p.count > 0 && <p className="flex gap-2 rounded-xl bg-[#b23a35]/[0.07] px-3.5 py-2.5 text-[13.5px] text-[#8f2d29]"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />This cannot be undone. Check the list below before you confirm. Everyone affected is emailed your name, the reason you give and how to challenge it.</p>}
                <div>
                  <p className="font-medium text-[#0e1b2c]">{p.count} will change</p>
                  <ul className="mt-1.5 max-h-56 divide-y divide-[#eef1f5] overflow-y-auto rounded-xl border border-[#dde2e8]">
                    {doing.map((i) => <li key={i.id} className="px-3 py-2"><span className="block font-medium text-[#0e1b2c]">{i.label}</span><span className="block text-[12.5px] text-[#5e6b7b]">{i.detail}</span></li>)}
                    {!doing.length && <li className="px-3 py-2 text-[#8a95a3]">Nothing in the selection can be changed.</li>}
                  </ul>
                </div>
                {skipped.length > 0 && (
                  <div>
                    <p className="font-medium text-[#0e1b2c]">{skipped.length} left alone</p>
                    <ul className="mt-1.5 space-y-1 text-[13px]">{skipped.map((i) => <li key={i.id}><span className="text-[#0e1b2c]">{i.label}</span>: <span className="text-[#5e6b7b]">{i.skip}</span></li>)}</ul>
                  </div>
                )}
                {p.count > 0 && (
                  <>
                    <label className="block font-medium text-[#0e1b2c]">Reason<input className="mt-1 h-11 w-full rounded-xl border border-[#dde2e8] px-3 text-[15px] font-normal outline-none focus:border-[#a8772a]" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Kept on the oversight record with every name" /></label>
                    {p.phrase && (
                      <>
                        <label className="block font-medium text-[#0e1b2c]">Type <span className="rounded bg-[#f5f7f9] px-1.5 py-0.5 font-semibold">{p.phrase}</span> to confirm
                          <input className="mt-1 h-11 w-full rounded-xl border border-[#dde2e8] px-3 text-[15px] font-normal outline-none focus:border-[#a8772a]" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" spellCheck={false} />
                        </label>
                        <label className="block font-medium text-[#0e1b2c]">Your password
                          <input type="password" className="mt-1 h-11 w-full rounded-xl border border-[#dde2e8] px-3 text-[15px] font-normal outline-none focus:border-[#a8772a]" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                          <span className="mt-1 block text-[12px] font-normal text-[#5e6b7b]">Asked again because this cannot be undone, so a session left open cannot be used to do it.</span>
                        </label>
                      </>
                    )}
                  </>
                )}
              </>
            )}
            {err && <p className="text-[13.5px] text-[#b23a35]">{err}</p>}
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-[#eef1f5] px-5 py-4">
            <button type="button" onClick={onClose} disabled={busy} className="h-11 rounded-full px-4 text-[14px] text-[#5e6b7b] hover:text-[#0e1b2c]">Cancel</button>
            <button type="button" onClick={run} disabled={!ready || busy}
              className={`h-11 rounded-full px-5 text-[14px] font-medium text-white disabled:opacity-40 ${action.danger ? 'bg-[#b23a35] hover:bg-[#9c302b]' : 'bg-[#0e1b2c] hover:bg-[#22344a]'}`}>
              {busy ? 'Working…' : p ? `${action.label.replace(/ \(.*\)$/, '')}: ${p.count}` : action.label}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

/** A tri-state "select all shown" checkbox. */
export function SelectAll({ ids, selected, onChange }: { ids: string[]; selected: string[]; onChange: (next: string[]) => void }) {
  const on = ids.length > 0 && ids.every((i) => selected.includes(i));
  const some = !on && ids.some((i) => selected.includes(i));
  return (
    <input type="checkbox" aria-label="Select every row shown" className="h-4 w-4 accent-[#0e1b2c]" checked={on}
      ref={(el) => { if (el) el.indeterminate = some; }}
      onChange={() => onChange(on ? selected.filter((s) => !ids.includes(s)) : [...new Set([...selected, ...ids])])} />
  );
}
