import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Dashboard building blocks shared by the client, staff and HQ dashboards.
 * Server-safe (no hooks). Every figure passed in must come from the record;
 * when there is nothing to show, pass null and the tile says so.
 */

export type Tone = 'ink' | 'good' | 'warn' | 'bad' | 'muted';
const TONE: Record<Tone, string> = { ink: 'text-[#0e1b2c]', good: 'text-[#2e7a57]', warn: 'text-[#b45309]', bad: 'text-[#b23a35]', muted: 'text-[#8a95a3]' };
const STROKE: Record<Tone, string> = { ink: '#0e1b2c', good: '#2e7a57', warn: '#b45309', bad: '#b23a35', muted: '#a8b2bf' };

/** A tiny line chart. Values oldest first. */
export function Sparkline({ values, tone = 'ink', height = 36 }: { values: number[]; tone?: Tone; height?: number }) {
  if (values.length < 2 || values.every((v) => v === 0)) return <div style={{ height }} className="flex items-end"><div className="h-px w-full bg-[#dde2e8]" /></div>;
  const w = 120;
  const max = Math.max(...values);
  const min = Math.min(0, ...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`);
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }} aria-hidden="true">
      <polygon points={`0,${height} ${pts.join(' ')} ${w},${height}`} fill={STROKE[tone]} opacity="0.07" />
      <polyline points={pts.join(' ')} fill="none" stroke={STROKE[tone]} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

/** One headline number. */
export function StatTile({ label, value, sub, tone = 'ink', href, spark, sparkTone }: {
  label: string; value: ReactNode; sub?: ReactNode; tone?: Tone; href?: string; spark?: number[]; sparkTone?: Tone;
}) {
  const body = (
    <>
      <p className="text-[13px] text-[#5e6b7b]">{label}</p>
      <p className={`mt-1 font-serif text-[30px] font-semibold leading-none ${TONE[tone]}`}>{value}</p>
      {sub && <p className="mt-2 text-[12.5px] leading-snug text-[#5e6b7b]">{sub}</p>}
      {spark && <div className="mt-3"><Sparkline values={spark} tone={sparkTone ?? (tone === 'muted' ? 'muted' : 'ink')} /></div>}
    </>
  );
  const cls = 'block h-full rounded-2xl border border-[#dde2e8] bg-white p-4 sm:p-5';
  return href ? <Link href={href} className={`${cls} transition-colors hover:border-[#a8772a]`}>{body}</Link> : <div className={cls}>{body}</div>;
}

export function TileGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}

/** A titled card. */
export function Panel({ title, href, linkLabel, children, className = '' }: { title: string; href?: string; linkLabel?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-[#dde2e8] bg-white p-4 sm:p-5 ${className}`}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-[#0e1b2c]">{title}</h2>
        {href && <Link href={href} className="shrink-0 text-[13px] font-medium text-[#8a6a1f] hover:underline underline-offset-2">{linkLabel ?? 'Open'}</Link>}
      </div>
      {children}
    </section>
  );
}

export type Segment = { label: string; n: number; color: string };

/** A single stacked bar with a legend. */
export function StackBar({ segments, empty = 'Nothing recorded yet.' }: { segments: Segment[]; empty?: string }) {
  const total = segments.reduce((a, s) => a + s.n, 0);
  if (!total) return <p className="text-[13px] text-[#8a95a3]">{empty}</p>;
  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[#eef1f5]">
        {segments.filter((s) => s.n > 0).map((s) => <span key={s.label} style={{ width: `${(s.n / total) * 100}%`, background: s.color }} />)}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-[#5e6b7b]">
        {segments.map((s) => <li key={s.label} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.label} <span className="font-medium text-[#0e1b2c]">{s.n.toLocaleString('en-GB')}</span></li>)}
      </ul>
    </div>
  );
}

/** Horizontal bars, largest first. */
export function BarList({ rows, format = (n) => n.toLocaleString('en-GB'), empty = 'Nothing recorded yet.' }: { rows: { label: string; n: number; href?: string }[]; format?: (n: number) => string; empty?: string }) {
  if (!rows.length) return <p className="text-[13px] text-[#8a95a3]">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.n)) || 1;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="text-[13px]">
          <div className="flex justify-between gap-3"><span className="truncate text-[#0e1b2c]">{r.href ? <Link href={r.href} className="hover:underline">{r.label}</Link> : r.label}</span><span className="shrink-0 text-[#5e6b7b]">{format(r.n)}</span></div>
          <div className="mt-1 h-1.5 rounded-full bg-[#eef1f5]"><div className="h-1.5 rounded-full bg-[#0e1b2c]" style={{ width: `${Math.max(2, (r.n / max) * 100)}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

/** Things that need someone, most urgent first. */
export function ActionList({ items, empty = 'Nothing needs you right now.' }: { items: { label: string; detail?: string; href: string; tone: 'bad' | 'warn' | 'muted' }[]; empty?: string }) {
  if (!items.length) return <p className="text-[13.5px] text-[#2e7a57]">{empty}</p>;
  const dot = { bad: 'bg-[#b23a35]', warn: 'bg-[#b45309]', muted: 'bg-[#a8b2bf]' } as const;
  return (
    <ul className="divide-y divide-[#eef1f5]">
      {items.map((i) => (
        <li key={i.label}>
          <Link href={i.href} className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-2.5 hover:bg-[#f5f7f9]">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot[i.tone]}`} />
            <span className="min-w-0"><span className="block text-[14px] font-medium text-[#0e1b2c]">{i.label}</span>{i.detail && <span className="block text-[12.5px] text-[#5e6b7b]">{i.detail}</span>}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Days ending today, oldest first, filled with zeros. */
export function dailySeries(rows: { day: string | Date; n: number }[], days: number, now = new Date()): number[] {
  const key = (d: Date) => d.toISOString().slice(0, 10);
  const m = new Map(rows.map((r) => [typeof r.day === 'string' ? r.day.slice(0, 10) : key(r.day), Number(r.n)]));
  const out: number[] = [];
  for (let i = days - 1; i >= 0; i--) out.push(m.get(key(new Date(now.getTime() - i * 86_400_000))) ?? 0);
  return out;
}

export const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: n < 100 ? 2 : 0, maximumFractionDigits: n < 100 ? 2 : 0 })}`;
export const pct = (n: number) => `${(n * 100).toFixed(n < 0.1 ? 1 : 0)}%`;
