'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import type { SetupProgress } from '@/lib/onboarding';
import { startSetupGuide } from '@/app/components/workspace/SetupGuide';

/** "Getting set up" on the dashboard, until every step is done. Read from the record, not ticked by hand. */
export function SetupPanel() {
  const [p, setP] = useState<SetupProgress | null>(null);
  useEffect(() => {
    fetch('/api/onboarding/progress', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then(setP).catch(() => {});
  }, []);
  if (!p || p.done === p.total) return null;
  const pct = Math.round((p.done / p.total) * 100);
  const open = p.steps.filter((s) => !s.done).slice(0, 3);
  return (
    <section className="rounded-2xl border border-[#a8772a]/30 bg-white p-4 sm:p-5" data-tour="dash-setup">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="min-w-[200px] flex-1">
          <h2 className="text-[15px] font-semibold text-[#0e1b2c]">Getting set up</h2>
          <div className="mt-2 flex items-center gap-3">
            <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-[#eef1f5]"><span className="absolute inset-y-0 left-0 rounded-full bg-[#2e7a57]" style={{ width: `${pct}%` }} /></span>
            <span className="text-[13px] text-[#5e6b7b]">{p.done} of {p.total} done</span>
          </div>
        </div>
        <button type="button" onClick={startSetupGuide} className="inline-flex h-11 items-center rounded-full bg-[#0e1b2c] px-5 text-sm font-medium text-white hover:bg-[#22344a]">{p.done === 0 ? 'Start the set-up guide' : 'Continue setting up'}</button>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-3">
        {open.map((s) => (
          <li key={s.id} className="flex items-start gap-2 rounded-xl bg-[#f5f7f9] px-3 py-2.5 text-[13px]">
            <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border border-[#c9ced6]" />
            <span><span className="font-medium text-[#0e1b2c]">{s.title}</span><span className="block text-[12px] text-[#8a95a3]">About {s.minutes} min</span></span>
          </li>
        ))}
      </ul>
      {p.done > 0 && <p className="mt-2.5 flex items-center gap-1.5 text-[12.5px] text-[#2e7a57]"><Check className="h-3.5 w-3.5" />{p.steps.filter((s) => s.done).map((s) => s.title).slice(0, 3).join(', ')}{p.done > 3 ? ` and ${p.done - 3} more` : ''}</p>}
    </section>
  );
}
