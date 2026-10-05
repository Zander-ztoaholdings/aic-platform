'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import DashboardShell from '../../components/DashboardShell';
import { PageHeader } from '@/app/components/ui/PageHeader';

type Item = {
  id: string; system: string; account: string; displayName: string | null; privilege: string | null; lastActiveAt: string | null;
  decision: 'keep' | 'remove' | 'reduce' | null; note: string | null; decidedByName: string | null; decidedAt: string | null; removedAt: string | null;
  person: { name: string; leftOn: string | null } | null;
};
type Data = { review: { id: string; name: string; status: string; dueAt: string | null; completedAt: string | null; createdAt: string }; items: Item[]; canManage: boolean; hasPeople: boolean };

const STALE_DAYS = 90;
const date = (v: string | null) => (v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const DECISION: Record<string, { label: string; on: string }> = {
  keep: { label: 'Keep', on: 'border-[#2e7a57] bg-[#2e7a57] text-white' },
  reduce: { label: 'Reduce', on: 'border-[#b45309] bg-[#b45309] text-white' },
  remove: { label: 'Remove', on: 'border-[#b23a35] bg-[#b23a35] text-white' },
};
const isAdmin = (p: string | null) => !!p && /admin|owner/i.test(p);

function flags(i: Item, hasPeople: boolean, now: number) {
  const out: { text: string; tone: string }[] = [];
  // Judged as of the snapshot: in a past review, someone who left afterwards was not a leaver yet.
  if (i.person?.leftOn && new Date(i.person.leftOn + 'T00:00:00Z').getTime() <= now) out.push({ text: `Left ${date(i.person.leftOn)}`, tone: 'text-[#b23a35]' });
  else if (hasPeople && !i.person) out.push({ text: 'Not on your people list', tone: 'text-[#b45309]' });
  if (i.lastActiveAt && now - new Date(i.lastActiveAt).getTime() > STALE_DAYS * 86_400_000) out.push({ text: `Not used since ${date(i.lastActiveAt)}`, tone: 'text-[#b45309]' });
  return out;
}

export default function AccessReviewPage() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [view, setView] = useState<'all' | 'undecided' | 'flagged'>('all');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [today] = useState(() => Date.now());

  const load = useCallback(() => {
    fetch(`/api/access-reviews/${id}`, { cache: 'no-store' }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setD(j); }).catch((e) => setError(e.message || 'Could not load the review.'));
  }, [id]);
  useEffect(load, [load]);

  async function patch(body: object) {
    setBusy(true); setMsg('');
    const r = await fetch(`/api/access-reviews/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg(j.error ?? 'Could not save.'); return false; }
    setPicked(new Set()); load(); return true;
  }

  const open = d?.review.status === 'open';
  // An open review is judged against today; a finished one against the day its accounts were read.
  const now = d && !open ? new Date(d.review.createdAt).getTime() : today;
  const editable = !!d?.canManage && open;
  const items = d?.items ?? [];
  const flagged = (i: Item) => flags(i, !!d?.hasPeople, now).length > 0 || isAdmin(i.privilege);
  const shown = useMemo(() => items.filter((i) => view === 'all' || (view === 'undecided' ? !i.decision : flagged(i))), [items, view]);
  const systems = [...new Set(shown.map((i) => i.system))];
  const decided = items.filter((i) => i.decision).length;
  const toRemove = items.filter((i) => i.decision === 'remove' || i.decision === 'reduce');
  const toggle = (ids: string[], on: boolean) => setPicked((p) => { const n = new Set(p); ids.forEach((x) => (on ? n.add(x) : n.delete(x))); return n; });

  return (
    <DashboardShell>
      <Link href="/access-reviews" className="mb-3 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-[#5e6b7b] hover:text-[#0e1b2c]"><ArrowLeft className="h-4 w-4" />All access reviews</Link>
      {error && <p className="text-sm text-[#b42318]">{error}</p>}
      {!d && !error && <p className="text-sm text-[#5e6b7b]">Loading…</p>}
      {d && (
        <>
          <PageHeader
            eyebrow="Access review"
            title={d.review.name}
            lede={open
              ? `Started ${date(d.review.createdAt)}, due ${date(d.review.dueAt)}. ${decided} of ${items.length} accounts decided.`
              : `Completed ${date(d.review.completedAt)}. ${toRemove.length} account${toRemove.length === 1 ? '' : 's'} to remove or reduce.`}
            actions={editable ? (
              <button type="button" disabled={busy || decided < items.length} onClick={() => patch({ complete: true })}
                title={decided < items.length ? 'Decide on every account first' : undefined}
                className="inline-flex h-11 items-center rounded-full bg-[#0e1b2c] px-5 text-sm font-medium text-white hover:bg-[#22344a] disabled:opacity-40">Complete review</button>
            ) : undefined}
          />

          {!open && toRemove.length > 0 && (
            <section className="mb-6 rounded-2xl border border-[#dde2e8] bg-white p-5">
              <h2 className="text-[15px] font-semibold text-[#0e1b2c]">Removals to carry out</h2>
              <p className="mt-0.5 text-[13.5px] text-[#5e6b7b]">Make each change in the system itself, then mark it done here. Until then the access review control shows a gap.</p>
              <ul className="mt-3 divide-y divide-[#eef1f5]">
                {toRemove.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-3 py-2.5">
                    <span className="min-w-0 flex-1 text-[14px]">
                      <span className="font-medium text-[#0e1b2c]">{i.displayName || i.account}</span>
                      <span className="text-[#5e6b7b]"> in {i.system}: {i.decision === 'remove' ? 'remove the account' : 'reduce its access'}{i.note ? `. ${i.note}` : ''}</span>
                    </span>
                    {i.removedAt ? <span className="inline-flex items-center gap-1 text-[13px] text-[#2e7a57]"><Check className="h-4 w-4" />Done {date(i.removedAt)}</span>
                      : d.canManage && <button type="button" disabled={busy} onClick={() => patch({ itemIds: [i.id], removed: true })} className="inline-flex h-9 items-center rounded-full border border-[#dde2e8] px-3.5 text-[13px] font-medium text-[#0e1b2c] hover:border-[#a8772a]">Mark as done</button>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="mb-3 flex flex-wrap items-center gap-2">
            {([['all', `All (${items.length})`], ['undecided', `Needs a decision (${items.length - decided})`], ['flagged', `Worth a closer look (${items.filter(flagged).length})`]] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setView(k)} className={`inline-flex min-h-[34px] items-center rounded-full border px-3 text-[13px] font-medium ${view === k ? 'border-[#0e1b2c] bg-[#0e1b2c] text-white' : 'border-[#dde2e8] bg-white text-[#0e1b2c] hover:border-[#a8772a]'}`}>{l}</button>
            ))}
            {msg && <span className="text-[13px] text-[#b23a35]">{msg}</span>}
          </div>

          {editable && picked.size > 0 && (
            <div className="sticky top-2 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[#0e1b2c]/15 bg-white px-4 py-2.5 shadow-sm">
              <span className="text-[14px] font-medium text-[#0e1b2c]">{picked.size} selected</span>
              {(['keep', 'reduce', 'remove'] as const).map((k) => <button key={k} type="button" disabled={busy} onClick={() => patch({ itemIds: [...picked], decision: k })} className={`inline-flex h-9 items-center rounded-full border px-3.5 text-[13px] font-medium ${DECISION[k].on}`}>{DECISION[k].label} all</button>)}
              <button type="button" onClick={() => setPicked(new Set())} className="px-2 text-[13px] text-[#5e6b7b] hover:text-[#0e1b2c]">Clear</button>
            </div>
          )}

          <div className="space-y-5">
            {systems.map((sys) => {
              const rows = shown.filter((i) => i.system === sys);
              const all = rows.every((i) => picked.has(i.id));
              return (
                <section key={sys} className="overflow-hidden rounded-2xl border border-[#dde2e8] bg-white">
                  <div className="flex items-center gap-3 border-b border-[#eef1f5] px-4 py-3">
                    {editable && <input type="checkbox" aria-label={`Select every ${sys} account`} checked={all} onChange={(e) => toggle(rows.map((i) => i.id), e.target.checked)} className="h-4 w-4 accent-[#0e1b2c]" />}
                    <h2 className="flex-1 text-[15px] font-semibold text-[#0e1b2c]">{sys}</h2>
                    <span className="text-[13px] text-[#5e6b7b]">{rows.filter((i) => i.decision).length} of {rows.length} decided</span>
                  </div>
                  <ul className="divide-y divide-[#eef1f5]">
                    {rows.map((i) => {
                      const f = flags(i, d.hasPeople, now);
                      return (
                        <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                          {editable && <input type="checkbox" aria-label={`Select ${i.account}`} checked={picked.has(i.id)} onChange={(e) => toggle([i.id], e.target.checked)} className="h-4 w-4 accent-[#0e1b2c]" />}
                          <span className="min-w-[220px] flex-1">
                            <span className="block text-[14.5px] font-medium text-[#0e1b2c]">{i.displayName || i.person?.name || i.account}</span>
                            <span className="block text-[12.5px] text-[#5e6b7b]">
                              {i.displayName || i.person ? `${i.account}, ` : ''}<span className={isAdmin(i.privilege) ? 'font-medium text-[#8a6a1f]' : ''}>{i.privilege ?? 'Member'}</span>
                              {i.lastActiveAt && !f.some((x) => x.text.startsWith('Not used')) ? `, last active ${date(i.lastActiveAt)}` : ''}
                            </span>
                            {f.length > 0 && <span className="mt-0.5 block text-[12.5px]">{f.map((x, n) => <span key={x.text} className={x.tone}>{n ? ', ' : ''}{n ? x.text.charAt(0).toLowerCase() + x.text.slice(1) : x.text}</span>)}</span>}
                          </span>
                          {editable ? (
                            <span className="flex gap-1">
                              {(['keep', 'reduce', 'remove'] as const).map((k) => (
                                <button key={k} type="button" disabled={busy} onClick={() => patch({ itemIds: [i.id], decision: k })}
                                  className={`inline-flex h-9 items-center rounded-full border px-3 text-[13px] font-medium ${i.decision === k ? DECISION[k].on : 'border-[#dde2e8] bg-white text-[#0e1b2c] hover:border-[#a8772a]'}`}>{DECISION[k].label}</button>
                              ))}
                            </span>
                          ) : (
                            <span className="text-[13px] text-[#5e6b7b]">{i.decision ? <><span className="font-medium text-[#0e1b2c]">{DECISION[i.decision].label}</span>{i.decidedByName ? `, by ${i.decidedByName}` : ''}</> : 'No decision'}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
            {systems.length === 0 && <p className="rounded-xl border border-[#dde2e8] bg-white px-4 py-5 text-[14px] text-[#5e6b7b]">Nothing here.</p>}
          </div>
        </>
      )}
    </DashboardShell>
  );
}
