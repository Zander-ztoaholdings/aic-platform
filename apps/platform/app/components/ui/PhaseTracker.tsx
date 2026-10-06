'use client';

import { Check } from 'lucide-react';

import { PHASES } from '@/lib/phases';
export { PHASES, phaseFromCertificationStatus } from '@/lib/phases';

export function PhaseTracker({ currentPhase = 2 }: { currentPhase?: number }) {
  return (
    <div className="bg-white border-b border-[#dde2e8] px-4 sm:px-6 py-3">
      <div className="max-w-5xl mx-auto">
        <div className="relative flex items-center">
          {/* Track line */}
          <div className="absolute top-[13px] left-[13px] right-[13px] h-px bg-[#dde2e8] z-0" />
          {/* Progress fill */}
          <div
            className="absolute top-[13px] left-[13px] h-px bg-[#a8772a] opacity-50 z-0 transition-all duration-500"
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
                      ? 'bg-[#a8772a] border-[#a8772a]'
                      : active
                      ? 'bg-white border-[#a8772a] shadow-[0_0_0_4px_rgba(201,146,10,0.15)]'
                      : 'bg-white border-[#dde2e8]'
                  }`}
                >
                  {done ? (
                    <Check className="w-3 h-3 text-white stroke-[2.5]" />
                  ) : (
                    <span
                      className={`text-[11px] font-bold ${
                        active ? 'text-[#a8772a]' : 'text-[#8a95a3]'
                      }`}
                    >
                      {phase.id}
                    </span>
                  )}
                </div>

                {/* Labels */}
                <div className="text-center">
                  <div
                    className={`text-[11.5px] font-semibold whitespace-nowrap ${
                      done || active ? 'text-[#0e1b2c]' : 'text-[#8a95a3]'
                    }`}
                  >
                    {phase.label}
                  </div>
                  <div
                    className={`text-[11px] whitespace-nowrap ${
                      active ? 'text-[#a8772a]' : 'text-[#8a95a3]'
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
