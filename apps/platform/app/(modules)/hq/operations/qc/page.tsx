'use client';

import { Eyebrow } from '@/app/components/ui/Eyebrow';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Pill, ago } from '@/app/components/admin/ui';

/**
 * Quality control: the evidence decisions assessors recorded in the last 60
 * days, for a second reviewer to sample. Replaces three invented "QC-102"
 * tasks attributed to a fictional "Dr. Sarah Khumalo" and a "98.4% accuracy"
 * figure nothing measured.
 */

type Decision = { id: string; title: string; outcome: string; notes: string | null; verified_at: string; org_id: string; organisation: string; requirement: string | null; reviewer: string | null };
const TONE: Record<string, 'good' | 'warn' | 'bad'> = { ACCEPTED: 'good', INSUFFICIENT: 'warn', REJECTED: 'bad' };
const LABEL: Record<string, string> = { ACCEPTED: 'Accepted', INSUFFICIENT: 'Not enough', REJECTED: 'Rejected' };

export default function QualityControlPage() {
  const [rows, setRows] = useState<Decision[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch('/api/v1/admin/qc', { cache: 'no-store' })
      .then(async (r) => { const b = await r.json(); if (!r.ok) throw new Error(b.error); setRows(b.decisions); })
      .catch((e) => setError(e.message || 'Could not load decisions.'));
  }, []);

  const byReviewer = new Map<string, number>();
  for (const r of rows ?? []) byReviewer.set(r.reviewer ?? 'Unknown', (byReviewer.get(r.reviewer ?? 'Unknown') ?? 0) + 1);

  return (
    <div className="space-y-6">
      <header>
        <Eyebrow>HQ operations</Eyebrow>
        <h1 className="font-serif text-[30px] md:text-[34px] leading-tight font-semibold text-[#0e1b2c]">Quality control</h1>
        <p className="mt-1 text-sm text-[#5e6b7b] max-w-2xl">
          Evidence decisions from the last 60 days. Sample them: open the file, read the note, and if you disagree, record a new outcome on the
          evidence review page. Both decisions stay on the record.
        </p>
      </header>
      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {rows && rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-[#c9ced6] bg-white p-6 text-sm text-[#5e6b7b]">No evidence decisions have been recorded in the last 60 days.</div>
      )}
      {rows && rows.length > 0 && (
        <>
          <p className="text-sm text-[#0e1b2c]">
            {rows.length} decision{rows.length === 1 ? '' : 's'}: {[...byReviewer].map(([n, c]) => `${n} ${c}`).join(', ')}.
          </p>
          <ul className="bg-white border border-[#dde2e8] rounded-xl divide-y divide-[#e6e9ee]">
            {rows.map((r) => (
              <li key={r.id} className="p-4 sm:p-5 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-[#0e1b2c]">{r.organisation}</span>
                  {r.requirement && <span className="text-sm text-[#5e6b7b]">{r.requirement}</span>}
                  <Pill tone={TONE[r.outcome] ?? 'neutral'}>{LABEL[r.outcome] ?? r.outcome}</Pill>
                </div>
                <p className="text-[13px] text-[#5e6b7b]">
                  <a href={`/api/evidence/${r.id}/file`} className="underline decoration-[#d5dbe2] underline-offset-2 text-[#0e1b2c]">{r.title}</a>
                  {' '}decided by {r.reviewer ?? 'an unknown reviewer'} {ago(r.verified_at)}.
                </p>
                {r.notes && <p className="text-[13px] text-[#0e1b2c]">“{r.notes}”</p>}
              </li>
            ))}
          </ul>
          <Link href="/admin/verification" className="inline-block text-sm font-medium text-[#8a6a1f] hover:underline">Open evidence review</Link>
        </>
      )}
    </div>
  );
}
