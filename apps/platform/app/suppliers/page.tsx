'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Plus, X } from 'lucide-react';
import DashboardShell from '../components/DashboardShell';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { CATEGORIES, CATEGORY_LABEL, DATA_KINDS, DATA_LABEL, OUTCOME_LABEL, REVIEW_MONTHS, type SupplierState } from '@/lib/registers/suppliers';

type Review = { id: string; outcome: string; notes: string | null; reviewedAt: string; nextReviewAt: string | null };
type Supplier = {
  id: string; name: string; website: string | null; purpose: string | null; country: string | null; ownerName: string | null;
  category: string; dataShared: string[]; outsideSa: boolean; hasDpa: boolean; criticality: string; status: string;
  nextReviewAt: string | null; lastReview: Review | null; reviews: Review[]; state: SupplierState; flags: string[];
};
type Suggestion = { name: string; website: string; category: string; country: string; dataShared: string[] };
type Data = { suppliers: Supplier[]; suggestions: Suggestion[]; canManage: boolean };

const STATE: Record<SupplierState, { label: string; tone: string }> = {
  not_reviewed: { label: 'Not reviewed', tone: 'bg-[#b45309]/12 text-[#b45309]' },
  due: { label: 'Review due', tone: 'bg-[#b45309]/12 text-[#b45309]' },
  current: { label: 'Reviewed', tone: 'bg-[#2e7a57]/10 text-[#2e7a57]' },
  rejected: { label: 'Not approved', tone: 'bg-[#b23a35]/12 text-[#b23a35]' },
};
const CRIT_LABEL: Record<string, string> = { high: 'High', medium: 'Medium', low: 'Low' };
const date = (v: string | null) => (v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const chip = (on: boolean) => `inline-flex min-h-[36px] items-center rounded-full border px-3 text-[13px] font-medium transition-colors ${on ? 'border-[#0e1b2c] bg-[#0e1b2c] text-white' : 'border-[#dde2e8] bg-white text-[#0e1b2c] hover:border-[#a8772a]'}`;
const input = 'mt-1 h-11 w-full rounded-xl border border-[#dde2e8] px-3 text-[15px] font-normal outline-none focus:border-[#a8772a]';

type Form = { name: string; website: string; purpose: string; country: string; ownerName: string; category: string; dataShared: string[]; outsideSa: boolean; hasDpa: boolean; criticality: string };
const fromSupplier = (s: Supplier | Suggestion | null): Form => ({
  name: s?.name ?? '', website: s?.website ?? '', purpose: (s && 'purpose' in s ? s.purpose : '') ?? '', country: s?.country ?? '',
  ownerName: (s && 'ownerName' in s ? s.ownerName : '') ?? '', category: s?.category ?? 'software', dataShared: s?.dataShared ?? [],
  outsideSa: s && 'outsideSa' in s ? s.outsideSa : !!s && !/south africa/i.test(s.country ?? ''),
  hasDpa: s && 'hasDpa' in s ? s.hasDpa : false, criticality: s && 'criticality' in s ? s.criticality : 'medium',
});

function Drawer({ supplier, seed, canManage, onClose, onSaved }: { supplier: Supplier | null; seed: Suggestion | null; canManage: boolean; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Form>(() => fromSupplier(supplier ?? seed));
  const [tab, setTab] = useState<'review' | 'details'>(supplier ? 'review' : 'details');
  const [outcome, setOutcome] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  async function send(url: string, method: string, body: unknown) {
    setBusy(true); setErr('');
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error ?? 'Could not save.'); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={supplier ? supplier.name : 'Add a supplier'}>
      <div className="absolute inset-0 bg-[#0a1728]/30" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-[-12px_0_40px_-12px_rgba(10,23,40,0.25)]">
        <div className="flex items-center justify-between border-b border-[#eef1f5] px-5 py-4">
          <h2 className="font-serif text-[20px] font-semibold text-[#0e1b2c]">{supplier ? supplier.name : 'Add a supplier'}</h2>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eef1f5]" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        {supplier && canManage && (
          <div className="flex gap-1 border-b border-[#eef1f5] px-5 pt-2">
            {(['review', 'details'] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)} className={`h-10 border-b-2 px-3 text-[14px] font-medium ${tab === t ? 'border-[#a8772a] text-[#0e1b2c]' : 'border-transparent text-[#5e6b7b] hover:text-[#0e1b2c]'}`}>{t === 'review' ? 'Review' : 'Details'}</button>
            ))}
          </div>
        )}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {supplier && supplier.flags.length > 0 && (
            <div className="space-y-1.5 rounded-xl border border-[#b23a35]/25 bg-[#b23a35]/[0.04] p-3.5">
              {supplier.flags.map((x) => <p key={x} className="flex gap-2 text-[13.5px] text-[#8f2d29]"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{x}</p>)}
            </div>
          )}
          {supplier && (tab === 'review' || !canManage) && (
            <>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[14px]">
                <div><dt className="text-[12.5px] text-[#8a95a3]">What they do for you</dt><dd className="text-[#0e1b2c]">{supplier.purpose || CATEGORY_LABEL[supplier.category]}</dd></div>
                <div><dt className="text-[12.5px] text-[#8a95a3]">Owner</dt><dd className={supplier.ownerName ? 'text-[#0e1b2c]' : 'text-[#b45309]'}>{supplier.ownerName || 'No owner'}</dd></div>
                <div><dt className="text-[12.5px] text-[#8a95a3]">Data they hold</dt><dd className="text-[#0e1b2c]">{supplier.dataShared.length ? supplier.dataShared.map((d) => DATA_LABEL[d]).join(', ') : 'Not stated'}</dd></div>
                <div><dt className="text-[12.5px] text-[#8a95a3]">Where</dt><dd className="text-[#0e1b2c]">{supplier.country || 'Not stated'}{supplier.outsideSa ? ', outside South Africa' : ''}</dd></div>
                <div><dt className="text-[12.5px] text-[#8a95a3]">How much rides on it</dt><dd className="text-[#0e1b2c]">{CRIT_LABEL[supplier.criticality]}, reviewed every {REVIEW_MONTHS[supplier.criticality]} months</dd></div>
                <div><dt className="text-[12.5px] text-[#8a95a3]">Data processing agreement</dt><dd className="text-[#0e1b2c]">{supplier.hasDpa ? 'Signed' : 'None on file'}</dd></div>
              </dl>
              {canManage && supplier.status === 'active' && (
                <section className="rounded-xl border border-[#dde2e8] p-4">
                  <h3 className="text-[15px] font-semibold text-[#0e1b2c]">Record a review</h3>
                  <p className="mt-0.5 text-[13px] text-[#5e6b7b]">Look at their security report or certificate, their data processing terms, and anything that has changed. Then record what you decided.</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {Object.entries(OUTCOME_LABEL).map(([k, v]) => <button key={k} type="button" onClick={() => setOutcome(k)} className={chip(outcome === k)}>{v}</button>)}
                  </div>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                    placeholder={outcome === 'approved' ? 'What you looked at (optional), e.g. SOC 2 report dated March, DPA signed' : 'The conditions, or why it was not approved'}
                    className="mt-3 w-full rounded-xl border border-[#dde2e8] px-3 py-2 text-[14px] outline-none focus:border-[#a8772a]" />
                  <button type="button" disabled={busy || !outcome} onClick={() => send(`/api/suppliers/${supplier.id}/reviews`, 'POST', { outcome, notes })}
                    className="mt-3 inline-flex h-11 items-center rounded-full bg-[#0e1b2c] px-5 text-sm font-medium text-white hover:bg-[#22344a] disabled:opacity-40">{busy ? 'Saving…' : 'Save review'}</button>
                </section>
              )}
              <section>
                <h3 className="text-[15px] font-semibold text-[#0e1b2c]">Review history</h3>
                {supplier.reviews.length === 0 ? <p className="mt-1 text-[14px] text-[#5e6b7b]">Not reviewed yet.</p> : (
                  <ol className="mt-2 space-y-2">
                    {supplier.reviews.map((r) => (
                      <li key={r.id} className="rounded-xl bg-[#f5f7f9] px-3.5 py-2.5 text-[14px]">
                        <p className="font-medium text-[#0e1b2c]">{OUTCOME_LABEL[r.outcome]} <span className="font-normal text-[#8a95a3]">on {date(r.reviewedAt)}</span></p>
                        {r.notes && <p className="mt-0.5 text-[13.5px] text-[#5e6b7b]">{r.notes}</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </>
          )}
          {canManage && (!supplier || tab === 'details') && (
            <>
              <label className="block text-[13px] font-medium text-[#0e1b2c]">Name<input value={f.name} onChange={(e) => set('name', e.target.value)} className={input} /></label>
              <label className="block text-[13px] font-medium text-[#0e1b2c]">What they do for you<input value={f.purpose} onChange={(e) => set('purpose', e.target.value)} placeholder="e.g. Hosts the loan scoring model" className={input} /></label>
              <div>
                <p className="text-[13px] font-medium text-[#0e1b2c]">Kind of supplier</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">{CATEGORIES.map((c) => <button key={c} type="button" onClick={() => set('category', c)} className={chip(f.category === c)}>{CATEGORY_LABEL[c]}</button>)}</div>
              </div>
              <div>
                <p className="text-[13px] font-medium text-[#0e1b2c]">Data they hold or can reach</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">{DATA_KINDS.map((k) => <button key={k} type="button" onClick={() => set('dataShared', f.dataShared.includes(k) ? f.dataShared.filter((x) => x !== k) : [...f.dataShared.filter((x) => k === 'none' ? false : x !== 'none'), k])} className={chip(f.dataShared.includes(k))}>{DATA_LABEL[k]}</button>)}</div>
              </div>
              <div>
                <p className="text-[13px] font-medium text-[#0e1b2c]">How much rides on them</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">{['high', 'medium', 'low'].map((c) => <button key={c} type="button" onClick={() => set('criticality', c)} className={chip(f.criticality === c)}>{CRIT_LABEL[c]}, every {REVIEW_MONTHS[c]} months</button>)}</div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-[13px] font-medium text-[#0e1b2c]">Country<input value={f.country} onChange={(e) => set('country', e.target.value)} className={input} /></label>
                <label className="block text-[13px] font-medium text-[#0e1b2c]">Owner<input value={f.ownerName} onChange={(e) => set('ownerName', e.target.value)} placeholder="Who looks after this supplier" className={input} /></label>
              </div>
              <label className="block text-[13px] font-medium text-[#0e1b2c]">Website<input value={f.website} onChange={(e) => set('website', e.target.value)} placeholder="https://" className={input} /></label>
              <div className="space-y-2">
                <label className="flex items-center gap-2.5 text-[14px] text-[#0e1b2c]"><input type="checkbox" checked={f.outsideSa} onChange={(e) => set('outsideSa', e.target.checked)} className="h-4 w-4 accent-[#0e1b2c]" />Data is stored or processed outside South Africa</label>
                <label className="flex items-center gap-2.5 text-[14px] text-[#0e1b2c]"><input type="checkbox" checked={f.hasDpa} onChange={(e) => set('hasDpa', e.target.checked)} className="h-4 w-4 accent-[#0e1b2c]" />We have a signed data processing agreement</label>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" disabled={busy || f.name.trim().length < 2} onClick={() => send(supplier ? `/api/suppliers/${supplier.id}` : '/api/suppliers', supplier ? 'PATCH' : 'POST', f)}
                  className="inline-flex h-11 items-center rounded-full bg-[#0e1b2c] px-5 text-sm font-medium text-white hover:bg-[#22344a] disabled:opacity-40">{busy ? 'Saving…' : supplier ? 'Save changes' : 'Add supplier'}</button>
                {supplier && (
                  <button type="button" disabled={busy} onClick={() => send(`/api/suppliers/${supplier.id}`, 'PATCH', { status: supplier.status === 'active' ? 'offboarded' : 'active' })}
                    className="h-11 px-3 text-sm font-medium text-[#5e6b7b] hover:text-[#0e1b2c]">{supplier.status === 'active' ? 'Mark as no longer used' : 'Mark as in use again'}</button>
                )}
              </div>
            </>
          )}
          {err && <p className="text-[13px] text-[#b23a35]">{err}</p>}
        </div>
      </div>
    </div>
  );
}

export default function SuppliersPage() {
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'attention' | 'offboarded'>('all');
  const [open, setOpen] = useState<{ supplier: Supplier | null; seed: Suggestion | null } | null>(null);

  const load = useCallback(() => {
    fetch('/api/suppliers', { cache: 'no-store' }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setD(j); }).catch((e) => setError(e.message || 'Could not load the supplier register.'));
  }, []);
  useEffect(load, [load]);

  const active = (d?.suppliers ?? []).filter((s) => s.status === 'active');
  const attention = active.filter((s) => s.flags.length || s.state !== 'current');
  const shown = useMemo(() => {
    const all = d?.suppliers ?? [];
    if (filter === 'offboarded') return all.filter((s) => s.status !== 'active');
    if (filter === 'attention') return attention;
    return active;
  }, [d, filter, active, attention]);

  return (
    <DashboardShell>
      <PageHeader
        eyebrow="Risk and people"
        title="Suppliers"
        lede="Everyone outside your organisation who holds your data or runs part of your service, how much rides on each, and when you last checked them."
        actions={d?.canManage ? <button type="button" onClick={() => setOpen({ supplier: null, seed: null })} className="inline-flex h-11 items-center gap-1.5 rounded-full bg-[#0e1b2c] px-5 text-sm font-medium text-white hover:bg-[#22344a]"><Plus className="h-4 w-4" />Add a supplier</button> : undefined}
      />
      {error && <p className="text-sm text-[#b42318]">{error}</p>}
      {!d && !error && <p className="text-sm text-[#5e6b7b]">Loading…</p>}
      {d && (
        <div className="space-y-5">
          {d.canManage && d.suggestions.length > 0 && (
            <section className="rounded-2xl border border-[#a8772a]/30 bg-[#a8772a]/[0.05] p-5">
              <h2 className="text-[15px] font-semibold text-[#0e1b2c]">Suppliers we can see from your connected systems</h2>
              <p className="mt-0.5 text-[13.5px] text-[#5e6b7b]">You use these but they are not on the register yet.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {d.suggestions.map((s) => <button key={s.name} type="button" onClick={() => setOpen({ supplier: null, seed: s })} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-[#dde2e8] bg-white px-4 text-[14px] font-medium text-[#0e1b2c] hover:border-[#a8772a]"><Plus className="h-3.5 w-3.5" />Add {s.name}</button>)}
              </div>
            </section>
          )}
          {d.suppliers.length === 0 ? (
            <div className="rounded-2xl border border-[#dde2e8] bg-white p-6">
              <p className="text-[15px] font-medium text-[#0e1b2c]">No suppliers recorded yet.</p>
              <p className="mt-1 max-w-2xl text-[14px] text-[#5e6b7b]">Start with the AI providers your models call, your cloud host and your payroll provider. POPIA section 21 expects a written agreement with anyone who processes personal information for you.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-1.5">
                {([['all', `In use (${active.length})`], ['attention', `Needs attention (${attention.length})`], ['offboarded', 'No longer used']] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setFilter(k)} className={chip(filter === k)}>{l}</button>)}
              </div>
              <div className="overflow-hidden rounded-2xl border border-[#dde2e8] bg-white">
                <table className="hidden w-full text-left text-[14px] md:table">
                  <thead className="border-b border-[#eef1f5] text-[12.5px] text-[#8a95a3]">
                    <tr><th className="px-4 py-3 font-medium">Supplier</th><th className="px-4 py-3 font-medium">Data</th><th className="px-4 py-3 font-medium">Criticality</th><th className="px-4 py-3 font-medium">Owner</th><th className="px-4 py-3 font-medium">Review</th></tr>
                  </thead>
                  <tbody>
                    {shown.map((s) => (
                      <tr key={s.id} onClick={() => setOpen({ supplier: s, seed: null })} className="cursor-pointer border-b border-[#eef1f5] last:border-0 hover:bg-[#f9fafb]">
                        <td className="px-4 py-3">
                          <p className="font-medium text-[#0e1b2c]">{s.name}{s.flags.length > 0 && <AlertTriangle className="ml-1.5 inline h-3.5 w-3.5 text-[#b23a35]" aria-label="Has a data protection gap" />}</p>
                          <p className="text-[12.5px] text-[#5e6b7b]">{CATEGORY_LABEL[s.category]}{s.country ? `, ${s.country}` : ''}</p>
                        </td>
                        <td className="px-4 py-3 text-[13px] text-[#5e6b7b]">{s.dataShared.length ? s.dataShared.map((x) => DATA_LABEL[x]).join(', ') : 'Not stated'}</td>
                        <td className="px-4 py-3 text-[13px] text-[#0e1b2c]">{CRIT_LABEL[s.criticality]}</td>
                        <td className={`px-4 py-3 text-[13px] ${s.ownerName ? 'text-[#0e1b2c]' : 'text-[#b45309]'}`}>{s.ownerName || 'No owner'}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${STATE[s.state].tone}`}>{STATE[s.state].label}</span>
                          {s.lastReview && <p className="mt-1 text-[12px] text-[#8a95a3]">{s.state === 'due' ? 'Was due' : 'Next'} {date(s.nextReviewAt)}</p>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <ul className="divide-y divide-[#eef1f5] md:hidden">
                  {shown.map((s) => (
                    <li key={s.id}>
                      <button type="button" onClick={() => setOpen({ supplier: s, seed: null })} className="w-full px-4 py-3.5 text-left">
                        <div className="flex items-start justify-between gap-3">
                          <span><span className="block text-[15px] font-medium text-[#0e1b2c]">{s.name}</span><span className="block text-[12.5px] text-[#5e6b7b]">{CATEGORY_LABEL[s.category]}, {CRIT_LABEL[s.criticality].toLowerCase()} criticality</span></span>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium ${STATE[s.state].tone}`}>{STATE[s.state].label}</span>
                        </div>
                        {s.flags.length > 0 && <p className="mt-1.5 text-[12.5px] text-[#b23a35]">{s.flags[0]}</p>}
                      </button>
                    </li>
                  ))}
                </ul>
                {shown.length === 0 && <p className="px-4 py-5 text-[14px] text-[#5e6b7b]">Nothing here.</p>}
              </div>
            </>
          )}
        </div>
      )}
      {open && d && <Drawer supplier={open.supplier} seed={open.seed} canManage={d.canManage} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); load(); }} />}
    </DashboardShell>
  );
}
