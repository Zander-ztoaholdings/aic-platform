'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import DashboardShell from '../components/DashboardShell';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { SectionCard } from '@/app/components/ui/Eyebrow';

type Slice = { key: string; label: string; cost: number; requests: number; share: number };
type Flag = { kind: string; severity: 'warn' | 'info'; title: string; detail: string };
type Data = {
  last30: number; monthToDate: number; lastMonth: number; projected: number | null; budget: number | null;
  daily: { day: string; cost: number }[]; byProvider: Slice[]; byModel: Slice[]; bySystem: Slice[];
  flags: Flag[]; hasData: boolean; canManage: boolean;
};

const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dayLabel = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function Daily({ daily }: { daily: Data['daily'] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...daily.map((d) => d.cost), 0.01);
  const lastWithData = daily.reduce((k, d, i) => (d.cost > 0 ? i : k), daily.length - 1);
  const h = hover ?? lastWithData;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[13px] text-[#5e6b7b]">{dayLabel(daily[h].day)}</div>
        <div className="font-serif text-[20px] font-semibold text-[#0e1b2c]">{usd(daily[h].cost)}</div>
      </div>
      <div className="mt-3 flex h-36 items-end gap-[2px]" onMouseLeave={() => setHover(null)} role="img" aria-label="Daily AI spend over the last 30 days">
        {daily.map((d, i) => (
          <button
            key={d.day}
            type="button"
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            className="group relative flex h-full flex-1 items-end"
            aria-label={`${dayLabel(d.day)}: ${usd(d.cost)}`}
          >
            <span
              className={`block w-full rounded-t-[4px] transition-colors ${i === h ? 'bg-[#8a6a1f]' : 'bg-[#a8772a]/55 group-hover:bg-[#a8772a]'}`}
              style={{ height: `${Math.max(d.cost > 0 ? 3 : 1, (d.cost / max) * 100)}%` }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[12px] text-[#8a95a3]">
        <span>{dayLabel(daily[0].day)}</span><span>{dayLabel(daily[daily.length - 1].day)}</span>
      </div>
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: Slice[] }) {
  const max = Math.max(...rows.map((r) => r.cost), 0.01);
  return (
    <SectionCard>
      <h2 className="text-[14px] font-semibold text-[#0e1b2c]">{title}</h2>
      {rows.length === 0 ? <p className="mt-2 text-[13px] text-[#5e6b7b]">No usage yet.</p> : (
        <ul className="mt-3 space-y-3">
          {rows.slice(0, 8).map((r) => (
            <li key={r.key}>
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className={`truncate ${r.key ? 'text-[#0e1b2c]' : 'text-[#b45309]'}`}>{r.label}</span>
                <span className="shrink-0 text-[#0e1b2c]">{usd(r.cost)} <span className="text-[#8a95a3]">· {Math.round(r.share * 100)}%</span></span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-[#eef1f5]"><div className="h-1.5 rounded-full bg-[#a8772a]" style={{ width: `${(r.cost / max) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

export default function SpendPage() {
  const [d, setD] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const [budget, setBudget] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    fetch('/api/spend', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((x: Data) => { setD(x); setBudget(x.budget ? String(x.budget) : ''); })
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  async function saveBudget(clear = false) {
    setSaving(true); setMsg('');
    const value = clear ? null : Number(budget);
    const r = await fetch('/api/spend', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ budgetUsd: value }) });
    const j = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok) { setMsg(j.error ?? 'Could not save.'); return; }
    setMsg(clear ? 'Budget cleared.' : 'Budget saved.');
    load();
  }

  return (
    <DashboardShell>
      <div className="max-w-5xl">
        <PageHeader
          eyebrow="AI overview"
          title="AI spend"
          lede="What your organisation spends on AI models, by provider, model and system, from the usage your connected providers report. Figures are in US dollars, as the providers bill them."
        />

        {failed && <p className="text-sm text-[#b42318]">Could not load spending. Try refreshing.</p>}
        {!d && !failed && <p className="text-sm text-[#5e6b7b]">Loading…</p>}

        {d && !d.hasData && (
          <SectionCard>
            <p className="text-sm font-medium text-[#0e1b2c]">No usage has reached AIC yet.</p>
            <p className="mt-1 text-[13px] leading-relaxed text-[#5e6b7b]">Connect OpenAI or Anthropic and your spending appears here, usually within a minute of the first check.</p>
            <Link href="/integrations" className="mt-4 inline-flex h-11 items-center rounded-full bg-[#0e1b2c] px-5 text-sm font-medium text-white hover:bg-[#22344a]">Connect an AI provider</Link>
          </SectionCard>
        )}

        {d && d.hasData && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { l: 'This month so far', v: usd(d.monthToDate) },
                { l: 'Likely month end', v: d.projected === null ? '—' : usd(d.projected) },
                { l: 'Last month', v: usd(d.lastMonth) },
                { l: 'Last 30 days', v: usd(d.last30) },
              ].map((s) => (
                <SectionCard key={s.l} className="p-4">
                  <div className="text-[13px] text-[#5e6b7b]">{s.l}</div>
                  <div className="mt-1 font-serif text-[26px] font-semibold text-[#0e1b2c]">{s.v}</div>
                </SectionCard>
              ))}
            </div>

            {d.flags.length > 0 && (
              <ul className="space-y-2">
                {d.flags.map((f, i) => (
                  <li key={i} className={`flex gap-3 rounded-xl border p-4 ${f.severity === 'warn' ? 'border-[#b45309]/30 bg-[#b45309]/[0.06]' : 'border-[#dde2e8] bg-white'}`}>
                    {f.severity === 'warn' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#b45309]" /> : <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#8a6a1f]" />}
                    <div>
                      <div className="text-sm font-semibold text-[#0e1b2c]">{f.title}</div>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-[#5e6b7b]">{f.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <SectionCard>
              <h2 className="text-[14px] font-semibold text-[#0e1b2c]">Daily spend, last 30 days</h2>
              <div className="mt-3"><Daily daily={d.daily} /></div>
            </SectionCard>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Breakdown title="By system" rows={d.bySystem} />
              <Breakdown title="By model" rows={d.byModel} />
              <Breakdown title="By provider" rows={d.byProvider} />
            </div>

            <SectionCard>
              <h2 className="text-[14px] font-semibold text-[#0e1b2c]">Monthly budget</h2>
              <p className="mt-1 text-[13px] text-[#5e6b7b]">AIC warns you here, and in the weekly summary, when the month is on course to pass it.</p>
              {d.canManage ? (
                <div className="mt-3 flex flex-col sm:flex-row gap-2 sm:items-center">
                  <div className="flex h-11 items-center rounded-xl border border-[#dde2e8] bg-white px-3 sm:w-48 focus-within:border-[#a8772a]">
                    <span className="text-sm text-[#5e6b7b]">$</span>
                    <input value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="e.g. 500" className="ml-1 w-full bg-transparent text-sm text-[#0e1b2c] outline-none" aria-label="Monthly budget in US dollars" />
                  </div>
                  <button onClick={() => saveBudget(false)} disabled={saving || !budget} className="inline-flex h-11 items-center justify-center rounded-full bg-[#0e1b2c] px-5 text-sm font-medium text-white hover:bg-[#22344a] disabled:opacity-50">Save budget</button>
                  {d.budget && <button onClick={() => saveBudget(true)} disabled={saving} className="inline-flex h-11 items-center justify-center rounded-full border border-[#dde2e8] bg-white px-5 text-sm font-medium text-[#0e1b2c] hover:border-[#a8772a]">Clear</button>}
                  {msg && <span className="text-[13px] text-[#5e6b7b]">{msg}</span>}
                </div>
              ) : (
                <p className="mt-2 text-sm text-[#0e1b2c]">{d.budget ? usd(d.budget) : 'No budget set.'} <span className="text-[13px] text-[#5e6b7b]">An organisation admin can change it.</span></p>
              )}
            </SectionCard>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
