'use client';

import { useEffect, useMemo, useState } from 'react';
import AdminShell from '@/app/components/admin/AdminShell';
import { Eyebrow } from '@/app/components/ui/Eyebrow';
import { Pill } from '@/app/components/admin/ui';

type Row = {
  key: string; name: string; category: string; organisations: number; lastOk: string | null;
  lastError: { message: string; at: string } | null; okRuns: number; errorRuns: number;
  unknownShare: number | null; state: 'not_used' | 'working' | 'failing' | 'partly_reading'; liveVerified: boolean; verifiedInCatalogue: boolean;
};

const STATE: Record<Row['state'], { label: string; tone: 'neutral' | 'good' | 'warn' | 'bad' }> = {
  not_used: { label: 'Not used yet', tone: 'neutral' },
  working: { label: 'Working', tone: 'good' },
  partly_reading: { label: 'Reads only part', tone: 'warn' },
  failing: { label: 'Failing', tone: 'bad' },
};
const FILTERS = [['all', 'All'], ['failing', 'Failing'], ['unproven', 'Not yet proven'], ['proven', 'Proven']] as const;
const when = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

export default function ConnectorHealthPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>('all');

  useEffect(() => {
    fetch('/api/v1/admin/connectors', { cache: 'no-store' }).then(async (r) => {
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setRows(j.connectors);
    }).catch((e) => setError(e.message || 'Could not load connector health.'));
  }, []);

  const proven = (r: Row) => r.liveVerified || r.verifiedInCatalogue;
  const shown = useMemo(() => (rows ?? []).filter((r) => filter === 'all' || (filter === 'failing' ? r.state === 'failing' : filter === 'proven' ? proven(r) : !proven(r)))
    .sort((a, b) => (a.state === 'failing' ? -1 : 0) - (b.state === 'failing' ? -1 : 0) || b.organisations - a.organisations || a.name.localeCompare(b.name)), [rows, filter]);
  const count = (f: (typeof FILTERS)[number][0]) => (rows ?? []).filter((r) => f === 'all' || (f === 'failing' ? r.state === 'failing' : f === 'proven' ? proven(r) : !proven(r))).length;

  return (
    <AdminShell>
      <header className="mb-6">
        <Eyebrow>Assessments</Eyebrow>
        <h1 className="font-serif text-[30px] md:text-[34px] leading-tight font-semibold text-[#0e1b2c]">Connector health</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-[#5e6b7b]">Which connectors have worked against real client accounts, and which are failing. A connector counts as proven once it has read a real account with most of its checks answered; until then clients see it marked as new.</p>
      </header>
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {!rows && !error && <p className="text-sm text-[#5e6b7b]">Loading…</p>}
      {rows && (
        <>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {FILTERS.map(([k, l]) => (
              <button key={k} type="button" onClick={() => setFilter(k)} className={`inline-flex min-h-[34px] items-center rounded-full border px-3 text-[13px] font-medium ${filter === k ? 'border-[#0e1b2c] bg-[#0e1b2c] text-white' : 'border-[#dde2e8] bg-white text-[#0e1b2c] hover:border-[#a8772a]'}`}>{l} ({count(k)})</button>
            ))}
          </div>
          <div className="overflow-x-auto rounded-xl border border-[#dde2e8] bg-white">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-[#dde2e8] text-xs text-[#8a95a3]">
                <tr><th className="px-4 py-3 font-medium">Connector</th><th className="px-3 py-3 font-medium">Organisations</th><th className="px-3 py-3 font-medium">State</th><th className="px-3 py-3 font-medium">Last success</th><th className="px-3 py-3 font-medium">Could not answer</th><th className="px-3 py-3 font-medium">Last error</th></tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.key} className="border-b border-[#eef1f5] align-top last:border-0">
                    <td className="px-4 py-3"><p className="font-medium text-[#0e1b2c]">{r.name}</p><p className="text-xs text-[#8a95a3]">{r.category}{proven(r) ? ', proven' : ''}</p></td>
                    <td className="px-3 py-3 text-[#0e1b2c]">{r.organisations}</td>
                    <td className="px-3 py-3"><Pill tone={STATE[r.state].tone}>{STATE[r.state].label}</Pill></td>
                    <td className="px-3 py-3 text-[#5e6b7b]">{when(r.lastOk)}</td>
                    <td className="px-3 py-3 text-[#5e6b7b]">{r.unknownShare === null ? '—' : `${Math.round(r.unknownShare * 100)}% of checks`}</td>
                    <td className="max-w-[320px] px-3 py-3 text-xs text-[#5e6b7b]">{r.lastError ? <details><summary className="cursor-pointer text-[#b23a35]">{when(r.lastError.at)}</summary><p className="mt-1 break-words">{r.lastError.message}</p></details> : '—'}</td>
                  </tr>
                ))}
                {shown.length === 0 && <tr><td colSpan={6} className="px-4 py-5 text-[#5e6b7b]">Nothing here.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AdminShell>
  );
}
