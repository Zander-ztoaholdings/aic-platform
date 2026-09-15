'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Eyebrow, SectionCard, CopperTag } from '@/app/components/ui/Eyebrow';
import { StatusChip } from '@/app/components/ui/StatusChip';

/**
 * The organisation's own profile, read live off /api/org/overview.
 *
 * This used to be entirely hardcoded — a fake registration number, a fake
 * accountable person literally labelled "(demo)", five fake "Executed
 * Agreements" with dead download buttons. /api/org/overview (built for the
 * /overview page and the insurer risk-score extract) already assembles
 * everything real this page needs: the org record, its current certificate,
 * its declared AI systems, and its on-record accountable person. This reads
 * that same assembly rather than inventing a second, competing picture of
 * the organisation.
 *
 * Declaring or changing an AI system or the accountable person happens on
 * /overview, which already has the real forms — this page links there
 * rather than duplicating write paths in a second place.
 */

type Overview = {
  organisation: {
    name: string;
    division: number | null;
    divisionName: string | null;
    standardVersion: string | null;
    certificationStatus: string | null;
    primaryAiOfficer: string | null;
    integrityScore: number | null;
  };
  certificate: {
    number: string | null;
    standard: string | null;
    status: string | null;
    issued: string | null;
    expires: string | null;
  } | null;
  inventory: {
    systems: {
      id: string;
      name: string;
      riskTier: number | null;
      lifecycleStage: string | null;
      isSandbox: boolean | null;
    }[];
  };
  accountability: {
    persons: {
      id: string;
      name: string;
      jobTitle: string | null;
      email: string;
      declarationVersion: string;
      declarationAcceptedAt: string;
    }[];
  };
  evidence: {
    byVerificationOutcome: Record<string, number>;
    lastVerifiedAt: string | null;
  };
};

const date = (v: string | null) =>
  v ? new Date(v).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  return (parts[0][0] + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
}

function systemChip(s: { lifecycleStage: string | null; isSandbox: boolean | null }) {
  const stage = (s.lifecycleStage ?? '').toUpperCase();
  if (stage === 'RETIRED') return 'expired' as const;
  if (stage === 'PRODUCTION' && !s.isSandbox) return 'active' as const;
  return 'pending' as const;
}

export default function OrganisationProfile() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/org/overview')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load');
        return r.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="space-y-5">
        <Eyebrow>Organisation Profile</Eyebrow>
        <SectionCard className="p-8 text-center">
          <p className="text-xs text-[#9ca3af]">Loading organisation profile…</p>
        </SectionCard>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-5">
        <Eyebrow>Organisation Profile</Eyebrow>
        <SectionCard className="p-8 text-center">
          <p className="text-xs text-[#9ca3af]">Could not load the organisation profile. Try refreshing.</p>
        </SectionCard>
      </div>
    );
  }

  const { organisation, certificate, inventory, accountability, evidence } = data;
  const person = accountability.persons[0] ?? null;

  const ORG_FIELDS = [
    { k: 'Organisation Name', v: organisation.name },
    {
      k: 'Division',
      v: organisation.division
        ? `Division ${organisation.division} — ${organisation.divisionName ?? '—'}`
        : 'Not yet assigned',
    },
    { k: 'Standard Version', v: organisation.standardVersion ?? '—' },
    { k: 'Certification Status', v: organisation.certificationStatus ?? '—' },
    { k: 'Primary AI Officer', v: organisation.primaryAiOfficer ?? 'Not recorded' },
    {
      k: 'Integrity Score',
      v: organisation.integrityScore !== null ? String(organisation.integrityScore) : '—',
    },
  ];

  const evidenceOutcomes = Object.entries(evidence.byVerificationOutcome).filter(([k]) => k !== 'UNSPECIFIED');

  return (
    <div className="space-y-5">
      <Eyebrow>Organisation Profile</Eyebrow>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 items-start">
        {/* Left column */}
        <div className="space-y-4">
          {/* Organisation Details */}
          <SectionCard>
            <div className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-4">
              Organisation Details
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ORG_FIELDS.map((r) => (
                <div key={r.k} className="bg-[#f9fafb] rounded-lg px-3 py-2.5">
                  <div className="font-mono text-[8px] text-[#9ca3af] uppercase tracking-[0.1em] mb-1">{r.k}</div>
                  <div className="text-xs font-semibold text-[#0f1f3d]">{r.v}</div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Certificate */}
          <SectionCard>
            <div className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-4">
              Certificate
            </div>
            {certificate ? (
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-[#0f1f3d]">{certificate.number ?? '—'}</div>
                  <div className="text-xs text-[#6b7280] mt-0.5">
                    {certificate.standard ?? '—'} · Issued {date(certificate.issued)} · Expires{' '}
                    {date(certificate.expires)}
                  </div>
                </div>
                <StatusChip status={certificate.status === 'ACTIVE' ? 'active' : 'pending'} />
              </div>
            ) : (
              <p className="text-xs text-[#9ca3af]">No certificate has been issued yet.</p>
            )}
          </SectionCard>

          {/* Evidence verification */}
          <SectionCard>
            <div className="flex items-center justify-between mb-4">
              <div className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">
                Evidence Verification
              </div>
              <Link
                href="/evidence"
                className="font-mono text-[9px] font-bold text-[#c9920a] hover:text-[#0f1f3d] transition-colors"
              >
                Open the vault →
              </Link>
            </div>
            {evidenceOutcomes.length === 0 ? (
              <p className="text-xs text-[#9ca3af]">No evidence has been verified yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2 mb-2">
                {evidenceOutcomes.map(([outcome, n]) => (
                  <CopperTag key={outcome}>
                    {outcome}: {n}
                  </CopperTag>
                ))}
              </div>
            )}
            <p className="font-mono text-[9px] text-[#9ca3af]">
              Last verified: {date(evidence.lastVerifiedAt)}
            </p>
          </SectionCard>
        </div>

        {/* Right rail */}
        <div className="space-y-3">
          {/* Accountable Person */}
          <SectionCard className="p-4">
            <div className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-3">
              Accountable Person
            </div>
            {person ? (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-[#0f1f3d] flex items-center justify-center font-mono text-sm font-bold text-[#c9920a] flex-shrink-0">
                    {initials(person.name)}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[#0f1f3d]">{person.name}</div>
                    <div className="font-mono text-[9px] text-[#c9920a]">
                      {person.jobTitle ?? 'No title recorded'}
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-[#f3f4f6]">
                  <div className="py-2">
                    <div className="font-mono text-[8px] text-[#9ca3af] uppercase tracking-[0.1em] mb-0.5">
                      Email
                    </div>
                    <div className="text-xs font-medium text-[#0f1f3d]">{person.email}</div>
                  </div>
                  <div className="py-2">
                    <div className="font-mono text-[8px] text-[#9ca3af] uppercase tracking-[0.1em] mb-0.5">
                      Declaration Accepted
                    </div>
                    <div className="text-xs font-medium text-[#0f1f3d]">
                      {person.declarationVersion} · {date(person.declarationAcceptedAt)}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-red-600 mb-3">No current declaration on record.</p>
            )}
            <Link
              href="/overview"
              className="w-full mt-3 inline-flex items-center justify-center gap-2 font-mono text-[9px] font-bold text-[#6b7280] border border-[#e5e7eb] rounded-full py-2 hover:border-[#c9920a] hover:text-[#c9920a] transition-colors"
            >
              {person ? 'Change Accountable Person' : 'Declare Accountable Person'} →
            </Link>
          </SectionCard>

          {/* AI Systems in Scope */}
          <SectionCard className="p-4">
            <div className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-3">
              AI Systems in Scope
            </div>
            {inventory.systems.length === 0 ? (
              <p className="text-xs text-[#9ca3af] mb-3">No systems declared yet.</p>
            ) : (
              <div className="divide-y divide-[#f3f4f6]">
                {inventory.systems.map((s) => (
                  <div key={s.id} className="flex items-center gap-2.5 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-[#0f1f3d] truncate">{s.name}</div>
                      <div className="font-mono text-[8px] text-[#9ca3af]">Tier {s.riskTier ?? '—'}</div>
                    </div>
                    <StatusChip status={systemChip(s)} />
                  </div>
                ))}
              </div>
            )}
            <Link
              href="/overview"
              className="w-full mt-3 inline-flex items-center justify-center gap-2 font-mono text-[9px] font-bold text-[#9ca3af] border border-dashed border-[#e5e7eb] rounded-full py-2 hover:border-[#c9920a] hover:text-[#c9920a] transition-colors"
            >
              Declare New AI System →
            </Link>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
