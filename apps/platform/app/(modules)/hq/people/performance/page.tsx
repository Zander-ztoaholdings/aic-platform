'use client';

import { Eyebrow } from '@/app/components/ui/Eyebrow';
import { useEffect, useState } from 'react';
import { ago, ROLE_LABEL } from '@/app/components/admin/ui';

/**
 * What each member of AIC staff has done, counted from the records they
 * signed: evidence they reviewed and findings they raised. Replaces three
 * invented people ("Dr. Sarah Khumalo", "Auditor #04") with made-up quality
 * percentages. There is no quality score: none is measured yet.
 */

type Staff = { id: string; name: string; email: string; role: string | null; last_login: string | null; evidence_reviewed: number; evidence_reviewed_30d: number; findings_raised: number; last_review: string | null };

export default function PerformanceRegistryPage() {
  const [staff, setStaff] = useState<Staff[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch('/api/v1/admin/staff-activity', { cache: 'no-store' })
      .then(async (r) => { const b = await r.json(); if (!r.ok) throw new Error(b.error); setStaff(b.staff); })
      .catch((e) => setError(e.message || 'Could not load staff activity.'));
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <Eyebrow>HQ people</Eyebrow>
        <h1 className="font-serif text-[30px] md:text-[34px] leading-tight font-semibold text-[#0e1b2c]">Staff activity</h1>
        <p className="mt-1 text-sm text-[#5e6b7b] max-w-2xl">What each member of AIC staff has signed off, from the records themselves.</p>
      </header>
      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {staff && staff.length === 0 && <p className="text-sm text-[#5e6b7b]">No staff accounts.</p>}
      {staff && staff.length > 0 && (
        <ul className="bg-white border border-[#dde2e8] rounded-xl divide-y divide-[#e6e9ee]">
          {staff.map((s) => (
            <li key={s.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#0e1b2c]">{s.name}</p>
                <p className="text-[13px] text-[#5e6b7b]">{(s.role && ROLE_LABEL[s.role]) || 'Staff'}. Last signed in {ago(s.last_login)}.</p>
              </div>
              <p className="text-[13px] text-[#0e1b2c] sm:text-right">
                {s.evidence_reviewed} evidence decision{s.evidence_reviewed === 1 ? '' : 's'} ({s.evidence_reviewed_30d} in 30 days), {s.findings_raised} finding{s.findings_raised === 1 ? '' : 's'} raised
                {s.last_review ? <span className="block text-[#5e6b7b]">Last review {ago(s.last_review)}</span> : null}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
