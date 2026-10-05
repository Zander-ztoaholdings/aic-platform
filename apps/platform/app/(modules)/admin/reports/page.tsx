'use client';

import { Eyebrow } from '@/app/components/ui/Eyebrow';
import { useEffect, useState } from 'react';
import AdminShell from '../components/AdminShell';
import { ago } from '@/app/components/admin/ui';

/**
 * Register-wide figures. Replaces three invented headline numbers
 * ("Certification velocity 4.2 weeks", "Bias incidence 1.8%", "Regulatory
 * coverage 84%") and three reports that were never generated. Every figure
 * here is a query; where nothing exists to measure, it says so.
 */

type Data = {
  orgs: { total: number; with_systems: number; with_person: number };
  byStatus: { status: string; n: number }[];
  velocity: { median_days: number | null; n: number };
  evidence: { waiting: number; oldest: string | null; accepted: number; rejected: number };
  findings: { open: number; overdue: number };
  checks: { orgs: number; failing: number };
  reports: { id: string; organisation: string | null; month_year: string; integrity_score: number; is_finalized: boolean; created_at: string }[];
};

function Figure({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="bg-white border border-[#dde2e8] rounded-xl p-4 sm:p-5">
      <p className="text-[13px] text-[#5e6b7b]">{label}</p>
      <p className="mt-1 text-[28px] font-semibold text-[#0e1b2c] tabular-nums">{value}</p>
      <p className="mt-1 text-[13px] text-[#5e6b7b]">{note}</p>
    </div>
  );
}

export default function ReportsPage() {
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch('/api/v1/admin/reports', { cache: 'no-store' })
      .then(async (r) => { const b = await r.json(); if (!r.ok) throw new Error(b.error); setD(b); })
      .catch((e) => setError(e.message || 'Could not load figures.'));
  }, []);

  return (
    <AdminShell>
      <div className="space-y-6">
        <header>
          <Eyebrow>Register</Eyebrow>
          <h1 className="font-serif text-[30px] md:text-[34px] leading-tight font-semibold text-[#0e1b2c]">Register figures</h1>
          <p className="mt-1 text-sm text-[#5e6b7b] max-w-2xl">Counts across every organisation on the platform, from the records themselves.</p>
        </header>
        {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {!d && !error && <p className="text-sm text-[#5e6b7b]">Loading…</p>}
        {d && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Figure label="Organisations" value={String(d.orgs.total)} note={`${d.orgs.with_systems} have declared an AI system; ${d.orgs.with_person} have named an accountable person.`} />
              <Figure
                label="Application to first certificate"
                value={d.velocity.median_days === null ? '—' : `${Math.round(d.velocity.median_days)} days`}
                note={d.velocity.n === 0 ? 'No certificate has been issued yet.' : `Median across ${d.velocity.n} certified organisation${d.velocity.n === 1 ? '' : 's'}.`}
              />
              <Figure
                label="Evidence waiting for review"
                value={String(d.evidence.waiting)}
                note={d.evidence.oldest ? `Oldest filed ${ago(d.evidence.oldest)}. ${d.evidence.accepted} accepted, ${d.evidence.rejected} sent back so far.` : `${d.evidence.accepted} accepted, ${d.evidence.rejected} sent back so far.`}
              />
              <Figure label="Open findings" value={String(d.findings.open)} note={`${d.findings.overdue} past their due date.`} />
              <Figure label="Failing automated checks" value={String(d.checks.failing)} note={`Across ${d.checks.orgs} organisation${d.checks.orgs === 1 ? '' : 's'} with connected systems.`} />
              <div className="bg-white border border-[#dde2e8] rounded-xl p-4 sm:p-5">
                <p className="text-[13px] text-[#5e6b7b]">Where organisations stand</p>
                <ul className="mt-2 space-y-1">
                  {d.byStatus.map((s) => (
                    <li key={s.status} className="flex justify-between text-[14px] text-[#0e1b2c]">
                      <span>{s.status.charAt(0) + s.status.slice(1).toLowerCase().replace(/_/g, ' ')}</span>
                      <span className="tabular-nums">{s.n}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <section className="bg-white border border-[#dde2e8] rounded-xl overflow-hidden">
              <h2 className="px-4 sm:px-5 py-4 border-b border-[#e6e9ee] font-semibold text-[#0e1b2c]">Monthly compliance reports</h2>
              {d.reports.length === 0 ? (
                <p className="p-5 text-sm text-[#5e6b7b]">No monthly report has been generated yet.</p>
              ) : (
                <ul className="divide-y divide-[#e6e9ee]">
                  {d.reports.map((r) => (
                    <li key={r.id} className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm">
                      <span className="font-medium text-[#0e1b2c] flex-1">{r.organisation ?? 'Organisation removed'}, {r.month_year}</span>
                      <span className="text-[#5e6b7b]">{r.is_finalized ? 'Final' : 'Draft'}, generated {ago(r.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </AdminShell>
  );
}
