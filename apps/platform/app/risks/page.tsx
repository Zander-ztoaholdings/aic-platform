'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import DashboardShell from '../components/DashboardShell';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { LIKELIHOOD, IMPACT, CATEGORIES, CATEGORY_LABEL, TREATMENTS, TREATMENT_LABEL, STATUSES, STATUS_LABEL, LEVEL_LABEL, score, level, type RiskLevel } from '@/lib/registers/risk';

type Risk = {
  id: string; title: string; description: string | null; category: string; likelihood: number; impact: number;
  residualLikelihood: number | null; residualImpact: number | null; treatment: string; treatmentPlan: string | null;
  controls: string[]; ownerName: string | null; status: string; reviewAt: string | null; updatedAt: string;
  score: number; level: RiskLevel; residualScore: number | null; overdue: boolean;
};
type Data = { risks: Risk[]; heatmap: number[][]; canManage: boolean; controls: { key: string; title: string; area: string }[] };

const LEVEL_TONE: Record<RiskLevel, string> = {
  low: 'bg-[#2e7a57]/10 text-[#2e7a57]', medium: 'bg-[#a8772a]/12 text-[#8a6a1f]', high: 'bg-[#b45309]/12 text-[#b45309]', critical: 'bg-[#b23a35]/12 text-[#b23a35]',
};
const CELL_TONE: Record<RiskLevel, string> = {
  low: 'bg-[#2e7a57]/[0.07]', medium: 'bg-[#a8772a]/[0.10]', high: 'bg-[#b45309]/[0.14]', critical: 'bg-[#b23a35]/[0.16]',
};
const date = (v: string | null) => (v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const chip = (on: boolean) => `inline-flex min-h-[36px] items-center rounded-full border px-3 text-[13px] font-medium transition-colors ${on ? 'border-[#0e1b2c] bg-[#0e1b2c] text-white' : 'border-[#dde2e8] bg-white text-[#0e1b2c] hover:border-[#a8772a]'}`;

type Form = {
  title: string; description: string; category: string; likelihood: number; impact: number; residualLikelihood: number | null; residualImpact: number | null;
  treatment: string; treatmentPlan: string; controls: string[]; ownerName: string; status: string; reviewAt: string;
};
const blank = (): Form => ({ title: '', description: '', category: 'security', likelihood: 3, impact: 3, residualLikelihood: null, residualImpact: null, treatment: 'mitigate', treatmentPlan: '', controls: [], ownerName: '', status: 'open', reviewAt: new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10) });

function Scale({ label, value, onChange, names, optional }: { label: string; value: number | null; onChange: (v: number | null) => void; names: string[]; optional?: boolean }) {
  return (
    <div>
      <p className="text-[13px] font-medium text-[#0e1b2c]">{label}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {names.map((n, i) => <button key={n} type="button" onClick={() => onChange(i + 1)} className={chip(value === i + 1)}>{i + 1} {n}</button>)}
        {optional && value !== null && <button type="button" onClick={() => onChange(null)} className="px-2 text-[13px] text-[#8a95a3] hover:text-[#0e1b2c]">Clear</button>}
      </div>
    </div>
  );
}

function Editor({ risk, controls, onClose, onSaved }: { risk: Risk | null; controls: Data['controls']; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Form>(() => risk ? {
    title: risk.title, description: risk.description ?? '', category: risk.category, likelihood: risk.likelihood, impact: risk.impact,
    residualLikelihood: risk.residualLikelihood, residualImpact: risk.residualImpact, treatment: risk.treatment, treatmentPlan: risk.treatmentPlan ?? '',
    controls: risk.controls, ownerName: risk.ownerName ?? '', status: risk.status, reviewAt: risk.reviewAt ? risk.reviewAt.slice(0, 10) : '',
  } : blank());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const s = score(f.likelihood, f.impact);
  const title = Object.fromEntries(controls.map((c) => [c.key, c.title]));

  async function save() {
    setBusy(true); setErr('');
    const r = await fetch(risk ? `/api/risks/${risk.id}` : '/api/risks', { method: risk ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error ?? 'Could not save.'); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={risk ? 'Edit risk' : 'Add a risk'}>
      <div className="absolute inset-0 bg-[#0a1728]/30" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-[-12px_0_40px_-12px_rgba(10,23,40,0.25)]">
        <div className="flex items-center justify-between border-b border-[#eef1f5] px-5 py-4">
          <h2 className="font-serif text-[20px] font-semibold text-[#0e1b2c]">{risk ? 'Edit risk' : 'Add a risk'}</h2>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eef1f5]" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <label className="block text-[13px] font-medium text-[#0e1b2c]">What could go wrong
            <input value={f.title} onChange={(e) => set('title', e.target.value)} maxLength={200} placeholder="e.g. Loan model declines a protected group more often" className="mt-1 h-11 w-full rounded-xl border border-[#dde2e8] px-3 text-[15px] font-normal outline-none focus:border-[#a8772a]" />
          </label>
          <label className="block text-[13px] font-medium text-[#0e1b2c]">More detail <span className="font-normal text-[#8a95a3]">(optional)</span>
            <textarea value={f.description} onChange={(e) => set('description', e.target.value)} rows={2} className="mt-1 w-full rounded-xl border border-[#dde2e8] px-3 py-2 text-[14px] font-normal outline-none focus:border-[#a8772a]" />
          </label>
          <div>
            <p className="text-[13px] font-medium text-[#0e1b2c]">Kind of risk</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">{CATEGORIES.map((c) => <button key={c} type="button" onClick={() => set('category', c)} className={chip(f.category === c)}>{CATEGORY_LABEL[c]}</button>)}</div>
          </div>
          <Scale label="How likely is it?" value={f.likelihood} onChange={(v) => set('likelihood', v ?? 3)} names={LIKELIHOOD} />
          <Scale label="How bad would it be?" value={f.impact} onChange={(v) => set('impact', v ?? 3)} names={IMPACT} />
          <p className="text-[13px] text-[#5e6b7b]">Score {s}: <span className={`rounded-full px-2 py-0.5 text-[12px] font-medium ${LEVEL_TONE[level(s)]}`}>{LEVEL_LABEL[level(s)]}</span></p>
          <div>
            <p className="text-[13px] font-medium text-[#0e1b2c]">What you will do about it</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">{TREATMENTS.map((t) => <button key={t} type="button" onClick={() => set('treatment', t)} className={chip(f.treatment === t)}>{TREATMENT_LABEL[t]}</button>)}</div>
            <textarea value={f.treatmentPlan} onChange={(e) => set('treatmentPlan', e.target.value)} rows={2} placeholder="The plan, in a sentence or two" className="mt-2 w-full rounded-xl border border-[#dde2e8] px-3 py-2 text-[14px] outline-none focus:border-[#a8772a]" />
          </div>
          <div>
            <p className="text-[13px] font-medium text-[#0e1b2c]">Controls that reduce it</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {f.controls.map((k) => (
                <span key={k} className="inline-flex items-center gap-1 rounded-full bg-[#a8772a]/10 py-1 pl-2.5 pr-1 text-[12px] font-medium text-[#6f5418]">{title[k] ?? k}
                  <button type="button" onClick={() => set('controls', f.controls.filter((x) => x !== k))} className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-[#a8772a]/20" aria-label={`Remove ${title[k]}`}><X className="h-3 w-3" /></button>
                </span>
              ))}
              <select value="" onChange={(e) => e.target.value && set('controls', [...f.controls, e.target.value])} aria-label="Add a control" className="h-8 rounded-full border border-dashed border-[#c9ced6] bg-white px-2 text-[12px] text-[#5e6b7b] outline-none">
                <option value="">Add a control</option>
                {controls.filter((c) => !f.controls.includes(c.key)).map((c) => <option key={c.key} value={c.key}>{c.title}</option>)}
              </select>
            </div>
          </div>
          <Scale label="Likelihood once treated (optional)" value={f.residualLikelihood} onChange={(v) => set('residualLikelihood', v)} names={LIKELIHOOD} optional />
          <Scale label="Impact once treated (optional)" value={f.residualImpact} onChange={(v) => set('residualImpact', v)} names={IMPACT} optional />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-[13px] font-medium text-[#0e1b2c]">Owner
              <input value={f.ownerName} onChange={(e) => set('ownerName', e.target.value)} placeholder="A named person" className="mt-1 h-11 w-full rounded-xl border border-[#dde2e8] px-3 text-[15px] font-normal outline-none focus:border-[#a8772a]" />
            </label>
            <label className="block text-[13px] font-medium text-[#0e1b2c]">Review by
              <input type="date" value={f.reviewAt} onChange={(e) => set('reviewAt', e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-[#dde2e8] px-3 text-[15px] font-normal outline-none focus:border-[#a8772a]" />
            </label>
          </div>
          <div>
            <p className="text-[13px] font-medium text-[#0e1b2c]">Status</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">{STATUSES.map((t) => <button key={t} type="button" onClick={() => set('status', t)} className={chip(f.status === t)}>{STATUS_LABEL[t]}</button>)}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 border-t border-[#eef1f5] px-5 py-4">
          <button type="button" onClick={save} disabled={busy || f.title.trim().length < 3} className="inline-flex h-11 items-center rounded-full bg-[#0e1b2c] px-5 text-sm font-medium text-white hover:bg-[#22344a] disabled:opacity-40">{busy ? 'Saving…' : risk ? 'Save changes' : 'Add risk'}</button>
          <button type="button" onClick={onClose} className="h-11 px-3 text-sm font-medium text-[#5e6b7b] hover:text-[#0e1b2c]">Cancel</button>
          {err && <span className="text-[13px] text-[#b23a35]">{err}</span>}
        </div>
      </div>
    </div>
  );
}

export default function RisksPage() {
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [cell, setCell] = useState<[number, number] | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [editing, setEditing] = useState<Risk | 'new' | null>(null);

  const load = useCallback(() => {
    fetch('/api/risks', { cache: 'no-store' }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setD(j); }).catch((e) => setError(e.message || 'Could not load the risk register.'));
  }, []);
  useEffect(load, [load]);

  const shown = useMemo(() => (d?.risks ?? []).filter((r) => (showClosed || r.status !== 'closed') && (!cell || (r.likelihood === cell[0] && r.impact === cell[1]))), [d, cell, showClosed]);
  const open = (d?.risks ?? []).filter((r) => r.status !== 'closed');
  const counts = { critical: open.filter((r) => r.level === 'critical').length, high: open.filter((r) => r.level === 'high').length, overdue: open.filter((r) => r.overdue).length, unowned: open.filter((r) => !r.ownerName).length };

  return (
    <DashboardShell>
      <PageHeader
        eyebrow="Risk and people"
        title="Risk register"
        lede="What could go wrong, how likely it is, how bad it would be, and what you are doing about it. Each risk has an owner and a review date."
        actions={d?.canManage ? <button type="button" onClick={() => setEditing('new')} className="inline-flex h-11 items-center gap-1.5 rounded-full bg-[#0e1b2c] px-5 text-sm font-medium text-white hover:bg-[#22344a]"><Plus className="h-4 w-4" />Add a risk</button> : undefined}
      />
      {error && <p className="text-sm text-[#b42318]">{error}</p>}
      {!d && !error && <p className="text-sm text-[#5e6b7b]">Loading…</p>}
      {d && d.risks.length === 0 && (
        <div className="rounded-2xl border border-[#dde2e8] bg-white p-6">
          <p className="text-[15px] font-medium text-[#0e1b2c]">No risks recorded yet.</p>
          <p className="mt-1 max-w-2xl text-[14px] text-[#5e6b7b]">Start with the three or four things that would hurt most: a model treating a group unfairly, customer data leaking, a key supplier failing. ISO 27001, ISO 42001 and the NIST frameworks all expect a register like this.</p>
        </div>
      )}
      {d && d.risks.length > 0 && (
        <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <section className="rounded-2xl border border-[#dde2e8] bg-white p-5">
              <h2 className="text-[15px] font-semibold text-[#0e1b2c]">Open risks by likelihood and impact</h2>
              <p className="mt-0.5 text-[12.5px] text-[#5e6b7b]">Tap a square to see only those risks.</p>
              <div className="mt-4 grid grid-cols-[18px_repeat(5,minmax(0,1fr))] gap-1">
                {[5, 4, 3, 2, 1].map((L) => (
                  <div key={L} className="contents">
                    <span className="flex items-center justify-center text-[11px] text-[#8a95a3]">{L}</span>
                    {[1, 2, 3, 4, 5].map((I) => {
                      const n = d.heatmap[L - 1][I - 1];
                      const on = cell?.[0] === L && cell?.[1] === I;
                      return (
                        <button key={I} type="button" disabled={n === 0} onClick={() => setCell(on ? null : [L, I])}
                          title={`${LIKELIHOOD[L - 1]}, ${IMPACT[I - 1].toLowerCase()}: ${n} risk${n === 1 ? '' : 's'}`}
                          className={`flex aspect-square items-center justify-center rounded-lg text-[13px] font-semibold tabular-nums ${CELL_TONE[level(L * I)]} ${on ? 'ring-2 ring-[#0e1b2c]' : ''} ${n ? 'text-[#0e1b2c] hover:ring-1 hover:ring-[#0e1b2c]/30' : 'text-transparent'}`}>{n || '0'}</button>
                      );
                    })}
                  </div>
                ))}
                <span />
                {[1, 2, 3, 4, 5].map((I) => <span key={I} className="text-center text-[11px] text-[#8a95a3]">{I}</span>)}
              </div>
              <div className="mt-2 flex justify-between text-[11.5px] text-[#8a95a3]"><span>Likelihood up</span><span>Impact across</span></div>
            </section>
            <section className="rounded-2xl border border-[#dde2e8] bg-white p-5 text-[14px] text-[#0e1b2c]">
              <p><span className="font-semibold">{open.length}</span> open{counts.critical ? <>, <span className="text-[#b23a35]">{counts.critical} critical</span></> : null}{counts.high ? <>, <span className="text-[#b45309]">{counts.high} high</span></> : null}.</p>
              {(counts.overdue > 0 || counts.unowned > 0) && <p className="mt-1 text-[13px] text-[#b23a35]">{[counts.unowned ? `${counts.unowned} without an owner` : '', counts.overdue ? `${counts.overdue} overdue for review` : ''].filter(Boolean).join(', ')}.</p>}
              <p className="mt-2 text-[12.5px] text-[#5e6b7b]">Score is likelihood × impact: 1 to 4 low, 5 to 9 medium, 10 to 16 high, 20 and above critical.</p>
            </section>
          </aside>
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] text-[#5e6b7b]">{cell ? <>Showing {LIKELIHOOD[cell[0] - 1].toLowerCase()}, {IMPACT[cell[1] - 1].toLowerCase()} risks. <button type="button" onClick={() => setCell(null)} className="font-medium text-[#8a6a1f] hover:underline">Show all</button></> : 'Highest score first.'}</p>
              <label className="flex items-center gap-2 text-[13px] text-[#5e6b7b]"><input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} className="h-4 w-4 accent-[#0e1b2c]" />Show closed</label>
            </div>
            <ul className="space-y-2">
              {shown.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => d.canManage && setEditing(r)} className={`w-full rounded-xl border border-[#dde2e8] bg-white px-4 py-3.5 text-left ${d.canManage ? 'hover:border-[#a8772a]/60' : 'cursor-default'} ${r.status === 'closed' ? 'opacity-60' : ''}`}>
                    <div className="flex flex-wrap items-start gap-3">
                      <span className={`mt-0.5 inline-flex h-7 min-w-[44px] items-center justify-center rounded-full px-2 text-[12.5px] font-semibold tabular-nums ${LEVEL_TONE[r.level]}`}>{r.score}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-medium text-[#0e1b2c]">{r.title}</span>
                        <span className="mt-0.5 block text-[13px] text-[#5e6b7b]">
                          {CATEGORY_LABEL[r.category] ?? r.category}, {TREATMENT_LABEL[r.treatment]?.toLowerCase()}, {STATUS_LABEL[r.status]?.toLowerCase()}{r.residualScore ? `, ${r.residualScore} once treated` : ''}
                        </span>
                      </span>
                      <span className="w-full pl-[56px] text-left text-[12.5px] sm:w-auto sm:shrink-0 sm:pl-0 sm:text-right">
                        <span className={`inline sm:block ${r.ownerName ? 'text-[#0e1b2c]' : 'text-[#b23a35]'}`}>{r.ownerName ?? 'No owner'}</span>
                        {r.reviewAt && <span className={`ml-2 inline sm:ml-0 sm:block ${r.overdue ? 'font-medium text-[#b23a35]' : 'text-[#8a95a3]'}`}>{r.overdue ? 'Review overdue' : 'Review'} {date(r.reviewAt)}</span>}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
              {shown.length === 0 && <li className="rounded-xl border border-[#dde2e8] bg-white px-4 py-5 text-[14px] text-[#5e6b7b]">Nothing matches.</li>}
            </ul>
          </section>
        </div>
      )}
      {editing && d && <Editor risk={editing === 'new' ? null : editing} controls={d.controls} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </DashboardShell>
  );
}
