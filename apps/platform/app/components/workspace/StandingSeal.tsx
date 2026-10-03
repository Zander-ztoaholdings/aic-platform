import { PHASES } from '@/lib/phases';

/**
 * The organisation's standing, drawn as a seal: seven arcs, one per stage of
 * the certification process, filled in brass up to the current stage.
 *
 * This is the one deliberate flourish in the workspace. A certification body's
 * product is, in the end, a seal; showing progress towards one says more than
 * a progress bar, and it stays honest because it only ever reflects the stored
 * certification status.
 */
export function StandingSeal({ phase, size = 112 }: { phase: number; size?: number }) {
  const n = PHASES.length;
  const r = 44;
  const c = 50;
  const gap = 5; // degrees between arcs
  const sweep = 360 / n - gap;
  const arc = (i: number) => {
    const a0 = ((-90 + i * (360 / n) + gap / 2) * Math.PI) / 180;
    const a1 = a0 + (sweep * Math.PI) / 180;
    const p = (a: number) => `${(c + r * Math.cos(a)).toFixed(2)} ${(c + r * Math.sin(a)).toFixed(2)}`;
    return `M ${p(a0)} A ${r} ${r} 0 0 1 ${p(a1)}`;
  };
  const stage = PHASES.find((p) => p.id === phase) ?? PHASES[0];

  return (
    <figure className="shrink-0" style={{ width: size }} aria-label={`Stage ${phase + 1} of ${n}: ${stage.label}`}>
      <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-hidden>
        {PHASES.map((p, i) => (
          <path key={p.id} d={arc(i)} fill="none" strokeLinecap="round" strokeWidth={i <= phase ? 5 : 3}
            stroke={i <= phase ? '#a8772a' : '#dde2e8'} />
        ))}
        <circle cx={c} cy={c} r={33} fill="none" stroke="#0e1b2c" strokeOpacity={0.08} />
        <text x={c} y={c - 2} textAnchor="middle" fontSize="20" fontWeight={600} fill="#0e1b2c" style={{ fontFamily: 'var(--font-source-serif), Georgia, serif' }}>
          {phase + 1}
        </text>
        <text x={c} y={c + 13} textAnchor="middle" fontSize="7.5" fill="#5e6b7b" style={{ fontFamily: 'var(--font-public-sans), sans-serif' }}>
          of {n}
        </text>
      </svg>
      <figcaption className="mt-1 text-center text-[12px] font-medium text-[#0e1b2c]">{stage.label}</figcaption>
    </figure>
  );
}
