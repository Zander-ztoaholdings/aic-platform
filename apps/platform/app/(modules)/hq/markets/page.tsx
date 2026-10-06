'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Eyebrow } from '@/app/components/ui/Eyebrow';
import { Portal } from '@/app/components/ui/Portal';
import { STAGES, STAGE_LABEL, STAGE_MEANING, MIN_NOTE, isOverdue, type Stage, type BoardSummary } from '@/lib/markets';

/**
 * AIC's own markets. This replaces two HQ pages that showed invented parity
 * percentages and buttons that did nothing. Everything here is what someone
 * entered, with the history of who moved what, and why.
 */

type Event = { id: string; fromStage: string | null; toStage: string | null; note: string; createdAt: string; actorName: string | null };
type Market = {
  id: string; code: string; name: string; region: string | null; law: string | null; automatedDecisionSection: string | null;
  regulator: string | null; stage: string; ownerName: string | null; nextStep: string | null; nextStepDue: string | null;
  notes: string | null; updatedAt: string; events: Event[];
};
type Data = { markets: Market[]; summary: BoardSummary; today: string };

const STAGE_TONE: Record<Stage, string> = {
  watching: 'bg-[#eef1f5] text-[#5e6b7b]',
  mapped: 'bg-[#0e1b2c]/[0.07] text-[#0e1b2c]',
  preparing: 'bg-[#a8772a]/12 text-[#8a6a1f]',
  entering: 'bg-[#b45309]/12 text-[#b45309]',
  live: 'bg-[#2e7a57]/10 text-[#2e7a57]',
  paused: 'bg-[#b23a35]/10 text-[#b23a35]',
};
const tone = (s: string) => STAGE_TONE[s as Stage] ?? STAGE_TONE.watching;
const label = (s: string | null) => (s ? STAGE_LABEL[s as Stage] ?? s : '');

const day = (v: string | null) => (v ? new Date(v.length === 10 ? v + 'T00:00:00Z' : v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: v.length === 10 ? 'UTC' : undefined }) : '');
const chip = (on: boolean) => `inline-flex min-h-[36px] items-center rounded-full border px-3 text-[13px] font-medium transition-colors ${on ? 'border-[#0e1b2c] bg-[#0e1b2c] text-white' : 'border-[#dde2e8] bg-white text-[#0e1b2c] hover:border-[#a8772a]'}`;
const input = 'mt-1 h-11 w-full rounded-xl border border-[#dde2e8] px-3 text-[15px] font-normal outline-none focus:border-[#a8772a]';
const area = 'mt-1 w-full rounded-xl border border-[#dde2e8] px-3 py-2 text-[14px] font-normal outline-none focus:border-[#a8772a]';
const primary = 'inline-flex h-11 items-center rounded-full bg-[#0e1b2c] px-5 text-sm font-medium text-white hover:bg-[#22344a] disabled:opacity-40';

type Form = {
  code: string; name: string; region: string; law: string; automatedDecisionSection: string; regulator: string;
  ownerName: string; nextStep: string; nextStepDue: string; notes: string;
};
const FIELDS = ['code', 'name', 'region', 'law', 'automatedDecisionSection', 'regulator', 'ownerName', 'nextStep', 'nextStepDue', 'notes'] as const;
const toForm = (m: Market | null): Form => Object.fromEntries(FIELDS.map((k) => [k, (m?.[k] as string | null) ?? ''])) as Form;

function Stamp({ e }: { e: Event }) {
  return (
    <li className="relative pl-5">
      <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-[#a8772a]" />
      <p className="text-[13px] text-[#0e1b2c]">
        {e.toStage && e.fromStage ? <>Moved from {label(e.fromStage).toLowerCase()} to <strong className="font-semibold">{label(e.toStage).toLowerCase()}</strong></>
          : e.toStage ? <>Added at <strong className="font-semibold">{label(e.toStage).toLowerCase()}</strong></>
          : <>Note</>}
      </p>
      <p className="mt-0.5 whitespace-pre-line text-[13px] leading-relaxed text-[#5e6b7b]">{e.note}</p>
      <p className="mt-0.5 text-[12px] text-[#8a95a3]">{e.actorName ?? 'Someone no longer on the system'}, {day(e.createdAt)}</p>
    </li>
  );
}

function Drawer({ market, onClose, onSaved }: { market: Market | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Form>(() => toForm(market));
  const [startStage, setStartStage] = useState<Stage>('watching');
  const [editNote, setEditNote] = useState('');
  const [moveTo, setMoveTo] = useState<Stage | null>(null);
  const [moveNote, setMoveNote] = useState('');
  const [removing, setRemoving] = useState(false);
  const [removeReason, setRemoveReason] = useState('');
  const [history, setHistory] = useState<Event[]>(market?.events ?? []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = <K extends keyof Form>(k: K, v: string) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    if (!market) return;
    let live = true;
    fetch(`/api/v1/hq/markets/${market.id}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (live && j?.events) setHistory(j.events); })
      .catch(() => {});
    return () => { live = false; };
  }, [market]);

  const changed = market ? FIELDS.filter((k) => f[k].trim() !== ((market[k] as string | null) ?? '')) : [];

  async function send(method: 'POST' | 'PATCH' | 'DELETE', body: unknown) {
    setBusy(true); setErr('');
    const r = await fetch(market ? `/api/v1/hq/markets/${market.id}` : '/api/v1/hq/markets', {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error ?? 'Could not save.'); return; }
    onSaved();
  }

  const save = () => {
    if (!market) return send('POST', { ...f, stage: startStage, note: editNote || undefined });
    const fields = Object.fromEntries(changed.map((k) => [k, f[k]]));
    return send('PATCH', { ...fields, note: editNote || undefined });
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={market ? market.name : 'Add a market'}>
        <div className="absolute inset-0 bg-[#0a1728]/30" onClick={onClose} />
        <div className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-[-12px_0_40px_-12px_rgba(10,23,40,0.25)]">
          <div className="flex items-center justify-between gap-3 border-b border-[#eef1f5] px-5 py-4">
            <div className="min-w-0">
              <h2 className="truncate font-serif text-[20px] font-semibold text-[#0e1b2c]">{market ? market.name : 'Add a market'}</h2>
              {market && <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[12px] font-medium ${tone(market.stage)}`}>{label(market.stage)}</span>}
            </div>
            <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eef1f5]" aria-label="Close"><X className="h-4 w-4" /></button>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
            <p className="rounded-xl bg-[#a8772a]/[0.08] px-3 py-2 text-[13px] text-[#6f5418]">Check the law and regulator details before relying on them.</p>

            {market && (
              <section className="rounded-2xl border border-[#dde2e8] p-4">
                <h3 className="text-[14px] font-semibold text-[#0e1b2c]">Move stage</h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {STAGES.filter((s) => s !== market.stage).map((s) => (
                    <button key={s} type="button" onClick={() => setMoveTo(moveTo === s ? null : s)} className={chip(moveTo === s)}>{STAGE_LABEL[s]}</button>
                  ))}
                </div>
                {moveTo && (
                  <div className="mt-3">
                    <p className="text-[13px] text-[#5e6b7b]">{STAGE_LABEL[moveTo]}: {STAGE_MEANING[moveTo].toLowerCase()}</p>
                    <label className="mt-2 block text-[13px] font-medium text-[#0e1b2c]">Why it is moving
                      <textarea value={moveNote} onChange={(e) => setMoveNote(e.target.value)} rows={2} placeholder="What happened, in a sentence" className={area} />
                    </label>
                    <button type="button" disabled={busy || moveNote.trim().length < MIN_NOTE} onClick={() => send('PATCH', { stage: moveTo, note: moveNote })} className={`${primary} mt-2`}>
                      {busy ? 'Saving…' : `Move to ${STAGE_LABEL[moveTo].toLowerCase()}`}
                    </button>
                    {moveNote.trim().length > 0 && moveNote.trim().length < MIN_NOTE && <p className="mt-1 text-[12px] text-[#8a95a3]">At least {MIN_NOTE} characters.</p>}
                  </div>
                )}
              </section>
            )}

            {!market && (
              <div>
                <p className="text-[13px] font-medium text-[#0e1b2c]">Stage it starts at</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {STAGES.filter((s) => s !== 'paused').map((s) => <button key={s} type="button" onClick={() => setStartStage(s)} className={chip(startStage === s)}>{STAGE_LABEL[s]}</button>)}
                </div>
                <p className="mt-1.5 text-[13px] text-[#5e6b7b]">{STAGE_MEANING[startStage]}</p>
              </div>
            )}

            <section className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-[110px_1fr]">
                <label className="block text-[13px] font-medium text-[#0e1b2c]">Code
                  <input value={f.code} onChange={(e) => set('code', e.target.value.toUpperCase())} maxLength={8} placeholder="NA" className={input} />
                </label>
                <label className="block text-[13px] font-medium text-[#0e1b2c]">Country or market
                  <input value={f.name} onChange={(e) => set('name', e.target.value)} maxLength={120} placeholder="Namibia" className={input} />
                </label>
              </div>
              <label className="block text-[13px] font-medium text-[#0e1b2c]">Region <span className="font-normal text-[#8a95a3]">(optional)</span>
                <input value={f.region} onChange={(e) => set('region', e.target.value)} maxLength={60} placeholder="SADC" className={input} />
              </label>
              <label className="block text-[13px] font-medium text-[#0e1b2c]">Law
                <input value={f.law} onChange={(e) => set('law', e.target.value)} placeholder="The act that governs automated decisions" className={input} />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-[13px] font-medium text-[#0e1b2c]">Section on automated decisions
                  <input value={f.automatedDecisionSection} onChange={(e) => set('automatedDecisionSection', e.target.value)} maxLength={120} placeholder="Section 71" className={input} />
                </label>
                <label className="block text-[13px] font-medium text-[#0e1b2c]">Regulator
                  <input value={f.regulator} onChange={(e) => set('regulator', e.target.value)} maxLength={200} className={input} />
                </label>
              </div>
              <label className="block text-[13px] font-medium text-[#0e1b2c]">Owner
                <input value={f.ownerName} onChange={(e) => set('ownerName', e.target.value)} maxLength={200} placeholder="A named person" className={input} />
              </label>
              <div className="grid gap-3 sm:grid-cols-[1fr_170px]">
                <label className="block text-[13px] font-medium text-[#0e1b2c]">Next step
                  <input value={f.nextStep} onChange={(e) => set('nextStep', e.target.value)} placeholder="What happens next, and by whom" className={input} />
                </label>
                <label className="block text-[13px] font-medium text-[#0e1b2c]">Due
                  <input type="date" value={f.nextStepDue} onChange={(e) => set('nextStepDue', e.target.value)} className={input} />
                </label>
              </div>
              <label className="block text-[13px] font-medium text-[#0e1b2c]">Notes <span className="font-normal text-[#8a95a3]">(optional)</span>
                <textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} rows={3} className={area} />
              </label>
              <label className="block text-[13px] font-medium text-[#0e1b2c]">{market ? 'Add to the history' : 'Why it is on the board'} <span className="font-normal text-[#8a95a3]">(optional)</span>
                <textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} rows={2} placeholder={market ? 'A note is saved to the history with these changes' : 'Recorded as the first entry in its history'} className={area} />
              </label>
            </section>

            {market && (
              <section>
                <h3 className="text-[14px] font-semibold text-[#0e1b2c]">History</h3>
                {history.length === 0
                  ? <p className="mt-2 text-[13px] text-[#5e6b7b]">Nothing recorded yet. Moves and notes appear here.</p>
                  : <ul className="mt-3 space-y-4 border-l border-[#eef1f5] pl-0">{history.map((e) => <Stamp key={e.id} e={e} />)}</ul>}
              </section>
            )}

            {market?.stage === 'watching' && (
              <section className="rounded-2xl border border-[#dde2e8] p-4">
                {!removing
                  ? <button type="button" onClick={() => setRemoving(true)} className="text-[13px] font-medium text-[#b23a35] hover:underline">Remove this market</button>
                  : (
                    <div>
                      <label className="block text-[13px] font-medium text-[#0e1b2c]">Why it is being removed
                        <textarea value={removeReason} onChange={(e) => setRemoveReason(e.target.value)} rows={2} className={area} />
                      </label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button type="button" disabled={busy || removeReason.trim().length < MIN_NOTE} onClick={() => send('DELETE', { reason: removeReason })} className="inline-flex h-11 items-center rounded-full bg-[#b23a35] px-5 text-sm font-medium text-white hover:bg-[#962f2b] disabled:opacity-40">Remove market</button>
                        <button type="button" onClick={() => setRemoving(false)} className="h-11 px-3 text-sm font-medium text-[#5e6b7b] hover:text-[#0e1b2c]">Keep it</button>
                      </div>
                    </div>
                  )}
              </section>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-[#eef1f5] px-5 py-4">
            <button type="button" onClick={save} disabled={busy || f.name.trim().length < 2 || f.code.trim().length < 2 || (!!market && changed.length === 0 && !editNote.trim())} className={primary}>
              {busy ? 'Saving…' : market ? 'Save changes' : 'Add market'}
            </button>
            <button type="button" onClick={onClose} className="h-11 px-3 text-sm font-medium text-[#5e6b7b] hover:text-[#0e1b2c]">Cancel</button>
            {err && <span className="text-[13px] text-[#b23a35]">{err}</span>}
          </div>
        </div>
      </div>
    </Portal>
  );
}

export default function MarketsPage() {
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Stage | null>(null);
  const [open, setOpen] = useState<Market | 'new' | null>(null);

  const load = useCallback(() => {
    fetch('/api/v1/hq/markets', { cache: 'no-store' })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setD(j); setError(''); })
      .catch((e) => setError(e.message || 'Could not load the markets.'));
  }, []);
  useEffect(load, [load]);

  const shown = d ? d.markets.filter((m) => !filter || m.stage === filter) : [];
  const last = (m: Market) => m.events[0];

  return (
    <div className="max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>HQ</Eyebrow>
          <h1 className="font-serif text-[30px] md:text-[34px] leading-tight font-semibold text-[#0e1b2c]">Markets</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5e6b7b] max-w-2xl">
            Where AIC is, and where it is going next. Each market has a stage, an owner and a next step; every move is recorded with a reason.
          </p>
        </div>
        <button type="button" onClick={() => setOpen('new')} className={primary}><Plus className="mr-1.5 h-4 w-4" />Add a market</button>
      </header>

      {error && <p className="rounded-2xl border border-[#b23a35]/30 bg-[#b23a35]/[0.05] px-4 py-3 text-[14px] text-[#b23a35]">{error}</p>}

      {d && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" role="group" aria-label="Filter by stage">
            {STAGES.map((s) => {
              const on = filter === s;
              return (
                <button key={s} type="button" onClick={() => setFilter(on ? null : s)} aria-pressed={on} title={STAGE_MEANING[s]}
                  className={`rounded-2xl border p-3 text-left transition-colors ${on ? 'border-[#0e1b2c] bg-[#0e1b2c] text-white' : 'border-[#dde2e8] bg-white text-[#0e1b2c] hover:border-[#a8772a]'}`}>
                  <span className="block text-[13px] font-medium">{STAGE_LABEL[s]}</span>
                  <span className="mt-0.5 block font-serif text-[24px] font-semibold leading-none">{d.summary.counts[s]}</span>
                  <span className={`mt-1 block text-[12px] leading-snug ${on ? 'text-white/75' : 'text-[#5e6b7b]'}`}>{STAGE_MEANING[s]}</span>
                </button>
              );
            })}
          </div>

          {d.summary.overdue.length > 0 && (
            <p className="text-[14px] text-[#b23a35]">
              {d.summary.overdue.length === 1 ? '1 next step is overdue: ' : `${d.summary.overdue.length} next steps are overdue: `}
              {d.summary.overdue.map((o, i) => (
                <span key={o.id}>{i > 0 && ', '}<button type="button" className="underline underline-offset-2" onClick={() => setOpen(d.markets.find((m) => m.id === o.id) ?? null)}>{o.name}</button></span>
              ))}.
            </p>
          )}

          {filter && (
            <p className="text-[13px] text-[#5e6b7b]">Showing {label(filter).toLowerCase()} only. <button type="button" onClick={() => setFilter(null)} className="font-medium text-[#0e1b2c] underline underline-offset-2">Show all</button></p>
          )}

          {shown.length === 0 ? (
            <div className="rounded-2xl border border-[#dde2e8] bg-white p-6 text-[14px] text-[#5e6b7b]">
              {d.markets.length === 0 ? 'No markets yet. Add the first one with the law, the regulator and who owns it.' : 'No markets at this stage. Pick another stage or show all.'}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[#dde2e8] bg-white">
              <table className="hidden w-full text-left text-[14px] md:table">
                <thead className="border-b border-[#eef1f5] text-[12px] font-medium text-[#5e6b7b]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Market</th>
                    <th className="px-4 py-3 font-medium">Law and regulator</th>
                    <th className="px-4 py-3 font-medium">Stage</th>
                    <th className="px-4 py-3 font-medium">Owner</th>
                    <th className="px-4 py-3 font-medium">Next step</th>
                    <th className="px-4 py-3 font-medium">Last change</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((m) => {
                    const late = isOverdue(m, d.today);
                    const e = last(m);
                    return (
                      <tr key={m.id} onClick={() => setOpen(m)} className="cursor-pointer border-b border-[#eef1f5] align-top last:border-0 hover:bg-[#f5f7f9]">
                        <td className="px-4 py-3">
                          <button type="button" onClick={(ev) => { ev.stopPropagation(); setOpen(m); }} className="text-left font-semibold text-[#0e1b2c] hover:underline">{m.name}</button>
                          {m.region && <span className="block text-[12px] text-[#8a95a3]">{m.region}</span>}
                        </td>
                        <td className="px-4 py-3 text-[#0e1b2c]">
                          {m.law ?? <span className="text-[#8a95a3]">—</span>}{m.automatedDecisionSection && <span className="text-[#5e6b7b]">, {m.automatedDecisionSection}</span>}
                          <span className="block text-[13px] text-[#5e6b7b]">{m.regulator ?? '—'}</span>
                        </td>
                        <td className="px-4 py-3"><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-medium ${tone(m.stage)}`}>{label(m.stage)}</span></td>
                        <td className="px-4 py-3 text-[#0e1b2c]">{m.ownerName ?? <span className="text-[#8a95a3]">No owner</span>}</td>
                        <td className="px-4 py-3">
                          <span className="text-[#0e1b2c]">{m.nextStep ?? <span className="text-[#8a95a3]">None set</span>}</span>
                          {m.nextStepDue && <span className={`block text-[13px] ${late ? 'font-medium text-[#b23a35]' : 'text-[#5e6b7b]'}`}>{late ? 'Overdue, was due ' : 'Due '}{day(m.nextStepDue)}</span>}
                        </td>
                        <td className="px-4 py-3 text-[13px] text-[#5e6b7b]">{e ? <>{day(e.createdAt)}<span className="block line-clamp-2">{e.note}</span></> : day(m.updatedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <ul className="divide-y divide-[#eef1f5] md:hidden">
                {shown.map((m) => {
                  const late = isOverdue(m, d.today);
                  const e = last(m);
                  return (
                    <li key={m.id}>
                      <button type="button" onClick={() => setOpen(m)} className="block w-full px-4 py-3 text-left hover:bg-[#f5f7f9]">
                        <span className="flex items-start justify-between gap-3">
                          <span className="min-w-0 font-semibold text-[#0e1b2c]">{m.name}</span>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[12px] font-medium ${tone(m.stage)}`}>{label(m.stage)}</span>
                        </span>
                        <span className="mt-1 block text-[13px] text-[#5e6b7b]">{[m.law, m.automatedDecisionSection].filter(Boolean).join(', ') || 'No law recorded'}</span>
                        <span className="block text-[13px] text-[#5e6b7b]">{m.regulator ?? 'No regulator recorded'}</span>
                        <span className="mt-1 block text-[13px] text-[#0e1b2c]">{m.ownerName ?? 'No owner'}{m.nextStep ? `: ${m.nextStep}` : ''}</span>
                        {m.nextStepDue && <span className={`block text-[13px] ${late ? 'font-medium text-[#b23a35]' : 'text-[#5e6b7b]'}`}>{late ? 'Overdue, was due ' : 'Due '}{day(m.nextStepDue)}</span>}
                        <span className="mt-1 block text-[12px] text-[#8a95a3]">Last change {day(e ? e.createdAt : m.updatedAt)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}

      {!d && !error && <p className="text-[14px] text-[#5e6b7b]">Loading markets…</p>}

      {open && (
        <Drawer
          key={open === 'new' ? 'new' : open.id}
          market={open === 'new' ? null : open}
          onClose={() => setOpen(null)}
          onSaved={() => { setOpen(null); load(); }}
        />
      )}
    </div>
  );
}
