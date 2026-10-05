'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, Search, ShieldCheck } from 'lucide-react';
import type { ChainLink } from '../../../lib/continuity';
import { narrateEvent } from '../../../lib/continuity';

/**
 * The record as a timeline.
 *
 * A thin activity strip shows when things changed (tap a day to see only that
 * day), quiet filters narrow it by what changed, and each entry opens to show
 * exactly what moved, who moved it, and the link that ties it to the entry
 * before. Everything is already on the page for the chain check, so filtering
 * is instant and needs no extra request.
 */

const DAY = 86_400_000;

const KIND: Record<string, { label: string; types: string[] }> = {
  systems: { label: 'AI systems', types: ['AI_SYSTEM', 'UNDECLARED_SYSTEM'] },
  people: { label: 'People', types: ['ACCOUNTABLE_PERSON'] },
  checks: { label: 'Checks', types: ['AUTOMATED_CHECK'] },
  findings: { label: 'Findings', types: ['FINDING'] },
  certificate: { label: 'Certificate', types: ['CERTIFICATE'] },
};

const ENTITY: Record<string, string> = {
  AI_SYSTEM: 'AI system', ACCOUNTABLE_PERSON: 'Accountable person', FINDING: 'Finding',
  CERTIFICATE: 'Certificate', UNDECLARED_SYSTEM: 'Undeclared AI', AUTOMATED_CHECK: 'Automated check',
};

const CHANGE: Record<string, { label: string; dot: string }> = {
  DECLARED: { label: 'declared', dot: 'bg-[#a8772a]' },
  CHANGED: { label: 'changed', dot: 'bg-[#0e1b2c]' },
  WITHDRAWN: { label: 'withdrawn', dot: 'bg-[#b23a35]' },
  OBSERVED: { label: 'observed', dot: 'bg-[#b45309]' },
};

// One fixed time zone, so the server render and the browser agree (a mismatch
// breaks hydration) and every reader sees the same day boundaries.
const TZ = 'Africa/Johannesburg';
const keyOf = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const dayKey = (iso: string) => keyOf(new Date(iso));
const fmtDay = (key: string, now: number) => {
  const today = keyOf(new Date(now));
  const yesterday = keyOf(new Date(now - DAY));
  if (key === today) return 'Today';
  if (key === yesterday) return 'Yesterday';
  return new Date(key + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: new Date(key).getUTCFullYear() === new Date(now).getUTCFullYear() ? undefined : 'numeric', timeZone: 'UTC' });
};
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
const short = (h: string | null) => (h ? `${h.slice(0, 8)}…${h.slice(-4)}` : 'the start of the record');
const field = (f: string | null) => (f ? f.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').toLowerCase().trim() : null);

function ActivityStrip({ events, now, day, onDay }: { events: ChainLink[]; now: number; day: string | null; onDay: (d: string | null) => void }) {
  const days = useMemo(() => {
    const first = events.length ? Math.min(...events.map((e) => new Date(e.observedAt).getTime())) : now;
    const span = Math.min(120, Math.max(30, Math.ceil((now - first) / DAY) + 2));
    const counts = new Map<string, number>();
    for (const e of events) counts.set(dayKey(e.observedAt), (counts.get(dayKey(e.observedAt)) ?? 0) + 1);
    return Array.from({ length: span }, (_, i) => {
      const key = keyOf(new Date(now - (span - 1 - i) * DAY));
      return { key, n: counts.get(key) ?? 0 };
    });
  }, [events, now]);
  const max = Math.max(1, ...days.map((d) => d.n));
  return (
    <div>
      <div className="flex h-9 items-end gap-[2px]" role="group" aria-label="Changes per day">
        {days.map((d) => {
          const on = day === d.key;
          return (
            <button
              key={d.key}
              type="button"
              disabled={d.n === 0}
              onClick={() => onDay(on ? null : d.key)}
              title={`${fmtDay(d.key, now)}: ${d.n} change${d.n === 1 ? '' : 's'}`}
              aria-label={`${fmtDay(d.key, now)}, ${d.n} change${d.n === 1 ? '' : 's'}`}
              aria-pressed={on}
              className="group flex h-full flex-1 items-end disabled:cursor-default"
            >
              <span
                className={`block w-full rounded-[2px] transition-colors ${d.n === 0 ? 'bg-[#eef1f5]' : on ? 'bg-[#0e1b2c]' : 'bg-[#a8772a]/55 group-hover:bg-[#a8772a]'}`}
                style={{ height: d.n === 0 ? 3 : `${Math.max(18, (d.n / max) * 100)}%` }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[11.5px] text-[#8a95a3]">
        <span>{fmtDay(days[0].key, now)}</span><span>Today</span>
      </div>
    </div>
  );
}

export function ContinuityFeed({ events, now, chainOk = true }: { events: ChainLink[]; now: number; chainOk?: boolean }) {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  const narrated = useMemo(() => events.map((e) => ({ e, sentence: narrateEvent(e) })), [events]);
  const counts = useMemo(() => Object.fromEntries(Object.entries(KIND).map(([k, v]) => [k, events.filter((e) => v.types.includes(e.entityType)).length])), [events]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return narrated.filter(({ e, sentence }) =>
      (!kind || KIND[kind].types.includes(e.entityType)) &&
      (!day || dayKey(e.observedAt) === day) &&
      (!needle || [sentence, e.entityLabel, e.actorLabel, e.changeType, ENTITY[e.entityType] ?? '', String(e.seq)].some((t) => t.toLowerCase().includes(needle))));
  }, [narrated, q, kind, day]);

  const groups = useMemo(() => {
    const out: { key: string; items: typeof filtered }[] = [];
    for (const item of filtered) {
      const k = dayKey(item.e.observedAt);
      const last = out[out.length - 1];
      if (last && last.key === k) last.items.push(item); else out.push({ key: k, items: [item] });
    }
    return out;
  }, [filtered]);

  const filtering = !!(q.trim() || kind || day);
  const pill = (on: boolean) => `inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors ${on ? 'border-[#0e1b2c] bg-[#0e1b2c] text-white' : 'border-[#dde2e8] bg-white text-[#5e6b7b] hover:text-[#0e1b2c]'}`;

  return (
    <div className="px-4 sm:px-6 pb-4">
      {events.length > 0 && <div className="pt-4"><ActivityStrip events={events} now={now} day={day} onDay={setDay} /></div>}

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="flex h-10 items-center gap-2 rounded-full border border-[#dde2e8] bg-white px-3.5 focus-within:border-[#a8772a] lg:w-72">
          <Search className="h-4 w-4 shrink-0 text-[#8a95a3]" />
          <input value={q} onChange={(ev) => setQ(ev.target.value)} placeholder="Search the record" aria-label="Search the record"
            className="w-full bg-transparent text-[14px] text-[#0e1b2c] outline-none placeholder:text-[#8a95a3]" />
        </label>
        <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
          <button type="button" className={pill(!kind)} onClick={() => setKind(null)}>Everything</button>
          {Object.entries(KIND).filter(([k]) => counts[k] > 0).map(([k, v]) => (
            <button key={k} type="button" className={pill(kind === k)} onClick={() => setKind(kind === k ? null : k)}>{v.label} <span className="opacity-60">{counts[k]}</span></button>
          ))}
        </div>
      </div>
      {filtering && (
        <p className="mt-2 text-[12.5px] text-[#5e6b7b]">
          {filtered.length} of {events.length} entries{day ? ` on ${fmtDay(day, now).toLowerCase() === 'today' ? 'today' : fmtDay(day, now)}` : ''}.{' '}
          <button type="button" onClick={() => { setQ(''); setKind(null); setDay(null); }} className="font-medium text-[#8a6a1f] hover:underline underline-offset-2">Show everything</button>
        </p>
      )}

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-[#8a95a3]">{events.length === 0 ? 'Nothing has been recorded yet.' : 'No entries match.'}</p>
      ) : (
        <div className="mt-5 space-y-6">
          {groups.map((g) => (
            <section key={g.key} className="grid gap-2 md:grid-cols-[140px_minmax(0,1fr)] md:gap-6">
              <h3 className="text-[13px] font-semibold text-[#0e1b2c] md:pt-2.5">{fmtDay(g.key, now)}<span className="ml-1.5 font-normal text-[#8a95a3]">{g.items.length}</span></h3>
              <ol className="relative border-l border-[#dde2e8] pl-5">
                {g.items.map(({ e, sentence }) => {
                  const isOpen = open === e.seq;
                  const c = CHANGE[e.changeType] ?? CHANGE.CHANGED;
                  const loud = e.entityType === 'UNDECLARED_SYSTEM' || e.changeType === 'WITHDRAWN';
                  return (
                    <li key={e.seq} className="relative">
                      <span className={`absolute -left-[25px] top-[15px] h-2.5 w-2.5 rounded-full ring-4 ring-white ${c.dot}`} aria-hidden />
                      <button type="button" onClick={() => setOpen(isOpen ? null : e.seq)} aria-expanded={isOpen}
                        className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${isOpen ? 'bg-[#f5f7f9]' : 'hover:bg-[#f8f9fb]'}`}>
                        <span className="min-w-0 flex-1">
                          <span className={`block text-[14px] leading-snug ${loud ? 'font-semibold text-[#b23a35]' : 'text-[#0e1b2c]'}`}>{sentence}</span>
                          <span className="mt-0.5 block text-[12.5px] text-[#8a95a3]">{ENTITY[e.entityType] ?? e.entityType}, {c.label} by {e.actorLabel} at {fmtTime(e.observedAt)}</span>
                        </span>
                        <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-[#8a95a3] transition-transform motion-reduce:transition-none ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isOpen && (
                        <div className="mx-3 mb-3 mt-1 grid gap-x-6 gap-y-2 rounded-xl border border-[#e6e9ee] bg-white p-4 text-[13px] sm:grid-cols-2">
                          <div><div className="text-[#8a95a3]">What</div><div className="text-[#0e1b2c]">{e.entityLabel}</div></div>
                          <div><div className="text-[#8a95a3]">When</div><div className="text-[#0e1b2c]">{new Date(e.observedAt).toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short', timeZone: TZ })}</div></div>
                          {(e.previousValue !== null || e.newValue !== null) && (
                            <div className="sm:col-span-2">
                              <div className="text-[#8a95a3]">{field(e.field) ? `Change to ${field(e.field)}` : 'Change'}</div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[#0e1b2c]">
                                {e.previousValue !== null && <span className="rounded-md bg-[#f5f7f9] px-2 py-0.5 line-through decoration-[#8a95a3]/60">{e.previousValue}</span>}
                                {e.previousValue !== null && e.newValue !== null && <span className="text-[#8a95a3]">to</span>}
                                {e.newValue !== null && <span className="rounded-md bg-[#a8772a]/10 px-2 py-0.5">{e.newValue}</span>}
                              </div>
                            </div>
                          )}
                          <div className="sm:col-span-2 flex items-start gap-2 border-t border-[#eef1f5] pt-2 text-[12.5px] text-[#5e6b7b]">
                            <ShieldCheck className={`mt-0.5 h-4 w-4 shrink-0 ${chainOk ? 'text-[#2e7a57]' : 'text-[#b23a35]'}`} />
                            <span>Entry {e.seq}, fingerprint {short(e.hash)}, linked to {e.previousHash ? `entry ${e.seq - 1} (${short(e.previousHash)})` : 'the start of the record'}. {chainOk ? 'Verified when this page loaded.' : 'The chain did not verify.'}</span>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
