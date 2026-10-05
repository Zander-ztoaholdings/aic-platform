'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Row = { claimId: string; policyId: string; verdict: 'contradicted' | 'partly' | 'consistent' | 'not_observed'; says: string };
const LABEL = { contradicted: 'Contradicted', partly: 'Partly true', consistent: 'Matches', not_observed: 'Not yet observed' } as const;
const DOT = { contradicted: 'bg-[#b42318]', partly: 'bg-[#b45309]', consistent: 'bg-[#2f7d4f]', not_observed: 'bg-[#c5cdd6]' } as const;

/** The promises in this policy, and whether the organisation's systems bear them out. */
export function PracticeForPolicy({ policyId }: { policyId: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    fetch('/api/says-vs-does', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .then((d) => setRows((d.results ?? []).filter((x: Row) => x.policyId === policyId)))
      .catch(() => setRows([]));
  }, [policyId]);
  if (!rows || rows.length === 0) return null;
  return (
    <div className="bg-white border border-[#dde2e8] rounded-xl p-5">
      <h2 className="text-[14px] font-semibold text-[#0e1b2c]">Checked against your systems</h2>
      <ul className="mt-2 space-y-2">
        {rows.map((r) => (
          <li key={r.claimId} className="flex items-start gap-2 text-[13px] leading-snug">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${DOT[r.verdict]}`} />
            <span><span className="text-[#0e1b2c]">{r.says}</span> <span className="text-[#5e6b7b]">{LABEL[r.verdict]}.</span></span>
          </li>
        ))}
      </ul>
      <Link href="/practice" className="mt-3 inline-block text-[13px] font-medium text-[#8a6a1f] hover:underline underline-offset-2">See the detail</Link>
    </div>
  );
}
