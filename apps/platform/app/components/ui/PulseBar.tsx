'use client';

import { Activity } from 'lucide-react';

interface PulseBarProps {
  /** Total decisions recorded for this org (decisionRecords count). Null while loading. */
  decisions: number | null;
  /** Human override rate as a 0-1 fraction (decisions.humanOverrideRate). Null when there are no decisions to compute a rate from. */
  overrideRate: number | null;
  /** organizations.integrity_score - the one score this app actually stores. */
  integrityScore: number | null;
  /** Correction requests still SUBMITTED or UNDER_REVIEW. Null while loading. */
  openCorrections: number | null;
}

// Every value here is a real field or count from /api/shell-summary. Where
// an org has no data yet for one of these (no decisions logged, division
// never scored) we show an em dash rather than a plausible-looking number -
// see DashboardHeader/PulseBar history: this bar used to hardcode all four
// values ("15,421 decisions" etc.) on every org, in production.
function formatStat(value: number | null, fmt: (v: number) => string): string {
  return value === null || value === undefined ? '—' : fmt(value);
}

export function PulseBar({ decisions, overrideRate, integrityScore, openCorrections }: PulseBarProps) {
  const stats = [
    {
      label: 'Decisions',
      value: formatStat(decisions, (v) => v.toLocaleString()),
      warn: false,
    },
    {
      label: 'Override Rate',
      value: formatStat(overrideRate, (v) => `${(v * 100).toFixed(2)}%`),
      warn: overrideRate !== null && overrideRate > 0.05,
    },
    {
      label: 'Integrity Score',
      value: formatStat(integrityScore, (v) => `${v}/100`),
      warn: integrityScore !== null && integrityScore < 60,
    },
    {
      label: 'Open Corrections',
      value: formatStat(openCorrections, (v) => `${v}`),
      warn: openCorrections !== null && openCorrections > 0,
    },
  ];

  return (
    <div className="bg-[#0f1f3d] px-7 py-2.5 flex items-center gap-5 flex-wrap">
      <div className="flex items-center gap-2">
        <Activity className="w-3 h-3 text-[#c9920a]" />
        <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#c9920a]">Pulse</span>
        <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
      </div>
      {stats.map((s) => (
        <div key={s.label} className="flex items-center gap-1.5">
          <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-white/30">{s.label}</span>
          <span className={`font-mono text-[11px] font-bold ${s.warn ? 'text-amber-400' : 'text-white'}`}>
            {s.value}
          </span>
        </div>
      ))}
    </div>
  );
}
