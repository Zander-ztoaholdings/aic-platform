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
