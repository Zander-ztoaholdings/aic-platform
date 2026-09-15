'use client';

import { Check } from 'lucide-react';

const PHASES = [
  { id: 0, label: 'Intake',      sub: '& Classification' },
  { id: 1, label: 'Onboarding',  sub: 'Agreements' },
  { id: 2, label: 'Evidence',    sub: 'Submission' },
  { id: 3, label: 'Analysis',    sub: 'Auto Review' },
  { id: 4, label: 'Audit',       sub: 'Auditor Review' },
  { id: 5, label: 'Decision',    sub: 'Certification' },
  { id: 6, label: 'Governance',  sub: 'Continuous' },
];

/**
 * Maps the org's real, stored `certification_status` onto this tracker's
 * seven phases. There is no separate DB flag for "still in intake" or
 * "still onboarding" - any org with a working dashboard session has, by
 * definition, already completed sign-up and its agreements, so those two
 * phases are treated as done rather than tracked separately. Everything
 * from Evidence onward follows the same status values used elsewhere in
 * the app (see app/api/evidence/route.ts's certStep for the same mapping
 * at a coarser grain).
 *
 * This replaces a hardcoded `currentPhase={2}` that showed every org as
 * "Analysis" regardless of where they actually were.
 */
export function phaseFromCertificationStatus(status: string | null | undefined): number {
  switch (status) {
    case 'CERTIFIED':
      return 6; // Governance - certified orgs are in continuous monitoring.
    case 'APPROVED':
      return 5;
    case 'IN_REVIEW':
    case 'UNDER_REVIEW':
      return 4;
    case 'PENDING_REVIEW':
      return 3;
    case 'DRAFT':
    default:
      return 2; // Evidence submission - the default working state.
  }
}

export function PhaseTracker({ currentPhase = 2 }: { currentPhase?: number }) {
  return (
    <div className="bg-white border-b border-[#e5e7eb] px-6 py-3">
      <div className="max-w-5xl mx-auto">
        <div className="relative flex items-center">
          {/* Track line */}
          <div className="absolute top-[13px] left-[13px] right-[13px] h-px bg-[#e5e7eb] z-0" />
          {/* Progress fill */}
          <div
            className="absolute top-[13px] left-[13px] h-px bg-[#c9920a] opacity-50 z-0 transition-all duration-500"
            style={{ width: `${(currentPhase / (PHASES.length - 1)) * 100}%` }}
          />

          {PHASES.map((phase) => {
            const done   = phase.id < currentPhase;
            const active = phase.id === currentPhase;

            return (
              <div key={phase.id} className="flex-1 flex flex-col items-center gap-1 relative z-10">
                {/* Dot */}
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all ${
                    done
                      ? 'bg-[#c9920a] border-[#c9920a]'
                      : active
                      ? 'bg-white border-[#c9920a] shadow-[0_0_0_4px_rgba(201,146,10,0.15)]'
                      : 'bg-white border-[#e5e7eb]'
                  }`}
                >
                  {done ? (
                    <Check className="w-3 h-3 text-white stroke-[2.5]" />
                  ) : (
                    <span
                      className={`font-mono text-[9px] font-bold ${
                        active ? 'text-[#c9920a]' : 'text-[#9ca3af]'
                      }`}
                    >
                      {phase.id}
                    </span>
                  )}
                </div>

                {/* Labels */}
                <div className="text-center">
                  <div
                    className={`text-[10px] font-semibold whitespace-nowrap ${
                      done || active ? 'text-[#0f1f3d]' : 'text-[#9ca3af]'
                    }`}
                  >
                    {phase.label}
                  </div>
                  <div
                    className={`font-mono text-[8px] whitespace-nowrap ${
                      active ? 'text-[#c9920a]' : 'text-[#9ca3af]'
                    }`}
                  >
                    {phase.sub}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
