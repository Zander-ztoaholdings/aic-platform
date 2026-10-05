'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Spend = { hasData: boolean; monthToDate: number; projected: number | null; budget: number | null; flags: { severity: string; title: string }[] };
type Practice = { publishedPolicies: number; summary: { contradicted: number; partly: number; consistent: number; total: number } };

const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Two live tiles on the continuity record: AI spend this month, and policy versus practice. */
export function DashboardInsights() {
  const [spend, setSpend] = useState<Spend | null>(null);
  const [practice, setPractice] = useState<Practice | null>(null);
  useEffect(() => {
    fetch('/api/spend', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then(setSpend).catch(() => {});
    fetch('/api/says-vs-does', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then(setPractice).catch(() => {});
  }, []);

  const issues = practice ? practice.summary.contradicted + practice.summary.partly : 0;
  const spendWarn = spend?.flags.find((f) => f.severity === 'warn');

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <Link href="/spend" className="lift block rounded-xl border border-[#dde2e8] bg-white p-5 hover:border-[#a8772a]">
        <div className="text-[13px] text-[#5e6b7b]">AI spend this month</div>
        {!spend ? <div className="mt-2 h-7 w-24 rounded bg-[#eef1f5]" /> : !spend.hasData ? (
          <p className="mt-1 text-sm text-[#0e1b2c]">Connect an AI provider to see what you spend.</p>
        ) : (
          <>
            <div className="mt-1 font-serif text-[28px] font-semibold text-[#0e1b2c]">{usd(spend.monthToDate)}</div>
            <p className="mt-1 text-[13px] text-[#5e6b7b]">
              {spendWarn ? <span className="text-[#b45309]">{spendWarn.title}.</span> : spend.projected !== null ? `On course for about ${usd(spend.projected)}${spend.budget ? ` against a ${usd(spend.budget)} budget` : ''}.` : 'First days of the month.'}
            </p>
          </>
        )}
      </Link>
      <Link href="/practice" className="lift block rounded-xl border border-[#dde2e8] bg-white p-5 hover:border-[#a8772a]">
        <div className="text-[13px] text-[#5e6b7b]">Policy versus practice</div>
        {!practice ? <div className="mt-2 h-7 w-24 rounded bg-[#eef1f5]" /> : practice.publishedPolicies === 0 ? (
          <p className="mt-1 text-sm text-[#0e1b2c]">Publish a policy and AIC checks it against your systems.</p>
        ) : (
          <>
            <div className={`mt-1 font-serif text-[28px] font-semibold ${issues ? 'text-[#b42318]' : 'text-[#2f7d4f]'}`}>{issues ? `${issues} to look at` : 'No contradictions'}</div>
            <p className="mt-1 text-[13px] text-[#5e6b7b]">{practice.summary.consistent} of {practice.summary.total} promises in your published policies match what your systems show.</p>
          </>
        )}
      </Link>
    </div>
  );
}
