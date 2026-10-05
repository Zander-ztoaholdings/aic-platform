'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import DashboardShell from '../components/DashboardShell';
import { PageHeader } from '@/app/components/ui/PageHeader';

type Review = {
  id: string; name: string; status: string; dueAt: string | null; createdAt: string; completedAt: string | null;
  total: number; decided: number; removals: number; removed: number;
};
type Data = { reviews: Review[]; canManage: boolean };

const date = (v: string | null) => (v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export default function AccessReviewsPage() {
  const router = useRouter();
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [startErr, setStartErr] = useState('');

  const load = useCallback(() => {
    fetch('/api/access-reviews', { cache: 'no-store' }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setD(j); }).catch((e) => setError(e.message || 'Could not load access reviews.'));
  }, []);
  useEffect(load, [load]);

  async function start() {
    setBusy(true); setStartErr('');
    const r = await fetch('/api/access-reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setStartErr(j.error ?? 'Could not start a review.'); return; }
    router.push(`/access-reviews/${j.id}`);
  }

  const open = d?.reviews.find((r) => r.status === 'open');
  const startButton = d?.canManage && !open ? (
    <button type="button" onClick={start} disabled={busy} className="inline-flex h-11 items-center gap-1.5 rounded-full bg-[#0e1b2c] px-5 text-sm font-medium text-white hover:bg-[#22344a] disabled:opacity-40"><Plus className="h-4 w-4" />{busy ? 'Reading accounts…' : 'Start a review'}</button>
  ) : undefined;

  return (
    <DashboardShell>
      <PageHeader
        eyebrow="Risk and people"
        title="Access reviews"
        lede="Every few months, look at who has an account in each connected system and confirm they still need it. AIC lists the accounts; you decide keep, remove or reduce."
        actions={startButton}
      />
      {startErr && <p className="mb-4 rounded-xl border border-[#b23a35]/25 bg-[#b23a35]/[0.04] px-4 py-3 text-[14px] text-[#8f2d29]">{startErr}</p>}
      {error && <p className="text-sm text-[#b42318]">{error}</p>}
      {!d && !error && <p className="text-sm text-[#5e6b7b]">Loading…</p>}
      {d && d.reviews.length === 0 && (
        <div className="rounded-2xl border border-[#dde2e8] bg-white p-6">
          <p className="text-[15px] font-medium text-[#0e1b2c]">No access reviews yet.</p>
          <p className="mt-1 max-w-2xl text-[14px] text-[#5e6b7b]">A review takes a snapshot of every account AIC can see in Microsoft 365, Google Workspace, GitHub and your other connected systems. Most auditors expect one every quarter for systems that hold customer data, and at least twice a year for the rest.</p>
        </div>
      )}
      {d && d.reviews.length > 0 && (
        <ul className="space-y-2">
          {d.reviews.map((r) => {
            const pct = r.total ? Math.round((r.decided / r.total) * 100) : 0;
            const overdue = r.status === 'open' && r.dueAt && new Date(r.dueAt).getTime() < Date.now();
            const outstanding = r.removals - r.removed;
            return (
              <li key={r.id}>
                <Link href={`/access-reviews/${r.id}`} className="flex items-center gap-4 rounded-xl border border-[#dde2e8] bg-white px-4 py-4 hover:border-[#a8772a]/60">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium text-[#0e1b2c]">{r.name}</span>
                    <span className="mt-0.5 block text-[13px] text-[#5e6b7b]">
                      {r.status === 'completed'
                        ? <>Completed {date(r.completedAt)}. {r.total} accounts, {r.removals} to remove or reduce{outstanding > 0 ? <span className="text-[#b23a35]">, {outstanding} not yet done</span> : r.removals ? ', all done' : ''}.</>
                        : <>{r.decided} of {r.total} accounts decided. <span className={overdue ? 'text-[#b23a35]' : ''}>{overdue ? 'Was due' : 'Due'} {date(r.dueAt)}</span>.</>}
                    </span>
                    {r.status === 'open' && <span className="mt-2 block h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-[#eef1f5]"><span className="block h-full rounded-full bg-[#a8772a]" style={{ width: `${pct}%` }} /></span>}
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium ${r.status === 'completed' ? 'bg-[#2e7a57]/10 text-[#2e7a57]' : 'bg-[#a8772a]/12 text-[#8a6a1f]'}`}>{r.status === 'completed' ? 'Completed' : 'In progress'}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[#8a95a3]" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardShell>
  );
}
