'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AdminShell from '../components/AdminShell';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { SectionCard } from '@/app/components/ui/Eyebrow';

type Interest = { id: string; email: string; company?: string | null; source?: string | null };

/**
 * CAAP practitioners. The credential launches in Q3 2027, so the register is
 * empty; what exists now is people who registered interest from the client
 * practitioner page (stored as leads with source CAAP_INTEREST).
 */
export default function PractitionersPage() {
  const [interest, setInterest] = useState<Interest[] | null>(null);

  useEffect(() => {
    fetch('/api/leads?source=CAAP_INTEREST&limit=200', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { leads: [] }))
      .then((d) => setInterest(d.leads ?? []))
      .catch(() => setInterest([]));
  }, []);

  return (
    <AdminShell>
    <div className="max-w-4xl">
      <PageHeader
        eyebrow="Register"
        title="Practitioners"
        lede="Certified AI Accountability Professionals. The credential opens in Q3 2027; until then there are no practitioner records, only people who have asked to be told when enrolment opens."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <SectionCard>
          <div className="text-[13px] text-[#5e6b7b]">Certified practitioners</div>
          <div className="mt-1 font-serif text-[28px] font-semibold text-[#0e1b2c]">0</div>
          <div className="text-[13px] text-[#5e6b7b]">The first cohort sits the exam after launch.</div>
        </SectionCard>
        <SectionCard>
          <div className="text-[13px] text-[#5e6b7b]">Registered interest</div>
          <div className="mt-1 font-serif text-[28px] font-semibold text-[#0e1b2c]">{interest === null ? '—' : interest.length}</div>
          <div className="text-[13px] text-[#5e6b7b]">From the Register interest button on the client practitioner page.</div>
        </SectionCard>
      </div>

      <SectionCard className="p-0 overflow-hidden">
        {interest === null ? (
          <p className="p-5 text-sm text-[#5e6b7b]">Loading…</p>
        ) : interest.length === 0 ? (
          <p className="p-5 text-sm text-[#5e6b7b]">Nobody has registered interest yet.</p>
        ) : (
          <ul className="divide-y divide-[#e6e9ee]">
            {interest.map((l) => (
              <li key={l.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 px-5 py-3.5">
                <span className="text-sm font-medium text-[#0e1b2c] break-all">{l.email}</span>
                <span className="text-[13px] text-[#5e6b7b]">{l.company ?? '—'}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <p className="mt-4 text-[13px] text-[#5e6b7b]">
        The assessor curriculum and exam for AIC’s own staff are in <Link href="/hq/training" className="font-medium text-[#8a6a1f] hover:underline underline-offset-2">HQ → Assessor academy</Link>.
      </p>
    </div>
    </AdminShell>
  );
}
