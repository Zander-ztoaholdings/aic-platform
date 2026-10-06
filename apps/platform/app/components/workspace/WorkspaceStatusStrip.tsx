'use client';

import { PHASES } from '../ui/PhaseTracker';

/**
 * One quiet line under the top bar: where the organisation's assessment
 * stands, and the four figures the record keeps.
 *
 * It replaces two full-width bars — the seven-dot phase tracker and the dark
 * "Pulse" strip — that between them took ~120px of every page. The phase
 * tracker's full view belongs on the certificate page, where someone is
 * actually asking "where am I in this"; here a single stage name is enough.
 *
 * The old Pulse strip also had a green dot that pulsed on every page for every
 * organisation, signalling a live feed that did not exist. There is no such dot
 * here. Every value is real or an em dash.
 */
export function WorkspaceStatusStrip({
  phase,
  decisions,
  overrideRate,
  failingChecks,
  openCorrections,
}: {
  phase: number;
  decisions: number | null;
  overrideRate: number | null;
  /** Failing automated checks; null when nothing is connected. */
  failingChecks: number | null;
  openCorrections: number | null;
}) {
  const stage = PHASES.find((p) => p.id === phase);
  const fmt = (v: number | null, f: (n: number) => string) => (v === null || v === undefined ? '—' : f(v));

  const stats = [
    { label: 'Decisions recorded', value: fmt(decisions, (v) => v.toLocaleString()), warn: false },
    { label: 'Override rate', value: fmt(overrideRate, (v) => `${(v * 100).toFixed(1)}%`), warn: false },
    { label: 'Failing checks', value: fmt(failingChecks, (v) => `${v}`), warn: failingChecks !== null && failingChecks > 0 },
    { label: 'Open corrections', value: fmt(openCorrections, (v) => `${v}`), warn: openCorrections !== null && openCorrections > 0 },
  ];

  const flagged = stats.filter((s) => s.warn);

  return (
    <div className="border-b border-[#0a1728]/[0.05] bg-white/60">
      {/* Phones: the stage, and only the figures that need attention. The full
          line scrolled sideways and cut off mid-word at 390px. */}
      <div className="sm:hidden px-5 py-2.5 flex items-center justify-between gap-3 text-[13px]">
        {stage && (
          <span className="flex items-center gap-2 text-[#5e6b7b] min-w-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#a8772a] shrink-0" aria-hidden />
            <span className="font-semibold text-[#0A1728] truncate">{stage.label}</span>
            <span className="text-[#8a95a3] shrink-0">{phase + 1} of {PHASES.length}</span>
          </span>
        )}
        {flagged.map((s) => (
          <span key={s.label} className="shrink-0 text-[#b45309]">
            {s.label === 'Open corrections' ? `${s.value} open` : s.label === 'Failing checks' ? `${s.value} failing` : `${s.label} ${s.value}`}
          </span>
        ))}
      </div>
      <div className="hidden sm:flex max-w-[1440px] mx-auto h-11 px-5 md:px-8 items-center gap-6 overflow-x-auto text-[12px] whitespace-nowrap">
        {stage && (
          <span className="flex items-center gap-2 text-[#5e6b7b]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#a8772a]" aria-hidden />
            Stage
            <span className="font-semibold text-[#0A1728]">{stage.label}</span>
            <span className="text-[#8a95a3]">
              {phase + 1} of {PHASES.length}
            </span>
          </span>
        )}
        <span className="w-px h-4 bg-[#0a1728]/[0.08] shrink-0" aria-hidden />
        {stats.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-[#5e6b7b]">
            {s.label}
            <span className={`font-semibold tabular-nums ${s.warn ? 'text-[#b45309]' : 'text-[#0A1728]'}`}>{s.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
