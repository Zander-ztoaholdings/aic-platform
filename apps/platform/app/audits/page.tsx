'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import DashboardShell from '../components/DashboardShell';
import { Eyebrow } from '../components/ui/Eyebrow';

/**
 * Technical audit log: results the AIC engine recorded against this
 * organisation's systems, hash-chained, with a check that the chain is
 * intact.
 *
 * The page used to have four "Run … audit" buttons that sent built-in SAMPLE
 * data to the engine and wrote the result into this organisation's audit log
 * as if it had been run on their system. Those buttons are gone. Audits are
 * run by the engine against real decision data, not from here.
 */

type Log = { id: string; systemName: string | null; eventType: string | null; status: string | null; createdAt: string | null };

function AuditsContent() {
  const q = useSearchParams().get('q');
  const [logs, setLogs] = useState<Log[] | null>(null);
  const [page, setPage] = useState({ page: 1, pages: 1, total: 0 });
  const [chain, setChain] = useState<{ valid: boolean; checked: number } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback((p = 1) => {
    let url = `/api/audit-logs?page=${p}&limit=25`;
    if (q) url += `&q=${encodeURIComponent(q)}`;
    fetch(url)
      .then(async (r) => { const b = await r.json(); if (!r.ok) throw new Error(b.error); setLogs(b.logs || []); setPage(b.pagination || { page: 1, pages: 1, total: 0 }); })
      .catch((e) => setError(e.message || 'Could not load the audit log.'));
  }, [q]);
  useEffect(() => { load(1); }, [load]);

  async function verify() {
    setVerifying(true);
    try {
      const r = await fetch('/api/audit-logs/verify', { method: 'POST' });
      const b = await r.json();
      setChain({ valid: !!b.is_valid, checked: (b.results ?? []).length });
    } catch {
      setError('The chain check could not run.');
    } finally {
      setVerifying(false);
    }
  }

  return (
    <DashboardShell>
      <div className="max-w-[920px] space-y-6">
        <header>
          <Eyebrow>Compliance tracking</Eyebrow>
          <h1 className="font-serif text-[30px] md:text-[34px] leading-tight font-semibold text-[#0e1b2c]">Technical audit log</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5e6b7b] max-w-2xl">
            Results the AIC audit engine recorded against your systems. Each entry is chained to the one before it, so a change to any entry is detectable.
          </p>
        </header>
        {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-[14px] text-red-700">{error}</div>}
        {logs && logs.length === 0 && (
          <div className="rounded-xl border border-dashed border-[#c9ced6] bg-white p-6 text-[14px] text-[#5e6b7b]">
            No technical audits have been recorded. They appear here once the AIC engine has run against your decision log.
          </div>
        )}
        {logs && logs.length > 0 && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-[14px] text-[#0e1b2c]">{page.total} entr{page.total === 1 ? 'y' : 'ies'}.</p>
              <button onClick={verify} disabled={verifying} className="h-11 sm:h-9 px-4 rounded-full border border-[#d5dbe2] text-[14px] font-medium text-[#0e1b2c] hover:border-[#a8772a] disabled:opacity-50">
                {verifying ? 'Checking…' : 'Check the chain'}
              </button>
            </div>
            {chain && (
              <p className={`rounded-xl px-4 py-3 text-[14px] ${chain.valid ? 'bg-[#2e7a57]/10 text-[#2e7a57]' : 'bg-red-50 text-red-700'}`}>
                {chain.valid ? `Chain intact: ${chain.checked} entries recomputed and matched.` : 'The chain is broken: at least one entry no longer matches. Tell AIC.'}
              </p>
            )}
            <ul className="bg-white border border-[#dde2e8] rounded-xl divide-y divide-[#e6e9ee]">
              {logs.map((l) => (
                <li key={l.id} className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                  <span className="text-[14px] font-medium text-[#0e1b2c] flex-1">{l.systemName ?? 'Unnamed system'}</span>
                  <span className="text-[13px] text-[#5e6b7b]">{(l.eventType ?? '').replace(/_/g, ' ').toLowerCase()}</span>
                  <span className="text-[13px] text-[#8a95a3]">{l.createdAt ? new Date(l.createdAt).toLocaleString('en-ZA') : ''}</span>
                </li>
              ))}
            </ul>
            {page.pages > 1 && (
              <div className="flex gap-2">
                <button disabled={page.page <= 1} onClick={() => load(page.page - 1)} className="h-9 px-4 rounded-full border border-[#d5dbe2] text-[13px] disabled:opacity-40">Newer</button>
                <button disabled={page.page >= page.pages} onClick={() => load(page.page + 1)} className="h-9 px-4 rounded-full border border-[#d5dbe2] text-[13px] disabled:opacity-40">Older</button>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}

export default function AuditsPage() {
  return (
    <Suspense>
      <AuditsContent />
    </Suspense>
  );
}
