'use client';

import { Activity } from 'lucide-react';

const STATS = [
  { label: 'Decisions',       value: '15,421', warn: false },
  { label: 'Override Rate',   value: '0.00%',  warn: true  },
  { label: 'Dignity Score',   value: '54/100', warn: true  },
  { label: 'Open Corrections',value: '3',      warn: false },
];

export function PulseBar() {
  return (
    <div className="bg-[#0f1f3d] px-7 py-2.5 flex items-center gap-5 flex-wrap">
      <div className="flex items-center gap-2">
        <Activity className="w-3 h-3 text-[#c9920a]" />
        <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#c9920a]">Pulse</span>
        <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
      </div>
      {STATS.map((s) => (
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
