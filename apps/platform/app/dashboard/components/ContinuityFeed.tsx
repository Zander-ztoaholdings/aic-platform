'use client';

import { useMemo, useState } from 'react';
import type { ChainLink } from '../../../lib/continuity';
import { narrateEvent } from '../../../lib/continuity';

const DAY = 24 * 60 * 60 * 1000;

const ENTITY_LABEL: Record<string, string> = {
  AI_SYSTEM: 'System',
  ACCOUNTABLE_PERSON: 'Accountable person',
  FINDING: 'Finding',
  CERTIFICATE: 'Certificate',
  UNDECLARED_SYSTEM: 'Undeclared system',
};

function ago(iso: string, now: number) {
  const d = Math.floor((now - new Date(iso).getTime()) / DAY);
  if (d <= 0) {
    const h = Math.floor((now - new Date(iso).getTime()) / (60 * 60 * 1000));
    return h <= 0 ? 'just now' : `${h}h ago`;
  }
  return d === 1 ? 'yesterday' : `${d}d ago`;
}

/**
 * The record, narrated and searchable.
 *
 * P0 per the PRD: "human-narrated declare/change/withdraw/observe entries,
 * searchable." Filters client-side against text already on the page — every
 * event this org has is already sent down for the chain-verification math
 * anyway (readContinuity() walks the whole chain), so there is no extra
 * fetch to add, and the compliance officer this is built for wants to type
 * "fraud-scoring-agent" or "withdrawn" and just see it narrow, not learn a
 * query language for a Friday demo.
 */
export function ContinuityFeed({ events, now }: { events: ChainLink[]; now: number }) {
  const [q, setQ] = useState('');

  const narrated = useMemo(
    () => events.map((e) => ({ e, sentence: narrateEvent(e) })),
    [events]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return narrated;
    return narrated.filter(
      ({ e, sentence }) =>
        sentence.toLowerCase().includes(needle) ||
        e.entityLabel.toLowerCase().includes(needle) ||
        e.entityType.toLowerCase().includes(needle) ||
        e.changeType.toLowerCase().includes(needle) ||
        e.actorLabel.toLowerCase().includes(needle) ||
        String(e.seq).includes(needle)
    );
  }, [narrated, q]);

  return (
    <div>
      <div className="px-6 pt-2 pb-3">
        <input
          type="text"
          value={q}
          onChange={(ev) => setQ(ev.target.value)}
          placeholder="Search the record — a system name, “withdrawn”, an entry number…"
          className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-aic-gold focus:ring-1 focus:ring-aic-gold/30"
        />
        {q.trim() !== '' && (
          <p className="mt-1.5 font-mono text-[10px] text-gray-400 uppercase tracking-[0.15em]">
            {filtered.length} of {events.length} match{filtered.length === 1 ? '' : 'es'}
          </p>
        )}
      </div>
      <div className="px-6 pb-2">
        {filtered.length === 0 ? (
          <p className="py-10 text-sm text-gray-400 text-center">
            {events.length === 0 ? 'No entries yet.' : `No entries match “${q}”.`}
          </p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {filtered.map(({ e, sentence }) => {
              const emphatic = e.entityType === 'UNDECLARED_SYSTEM' || e.changeType === 'WITHDRAWN';
              return (
                <li key={e.seq} className="py-3 flex items-start gap-4">
                  <span className="font-mono text-[10px] text-gray-300 tabular-nums pt-0.5 w-12 shrink-0">
                    #{e.seq}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-gray-400">
                      {ENTITY_LABEL[e.entityType] ?? e.entityType}
                    </span>
                    <p className={`mt-0.5 text-sm leading-snug ${emphatic ? 'text-red-700 font-semibold' : 'text-aic-navy'}`}>
                      {sentence}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-[10px] text-gray-400">{ago(e.observedAt, now)}</div>
                    <div className="font-mono text-[9px] text-gray-300 truncate max-w-[10rem]">{e.actorLabel}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
