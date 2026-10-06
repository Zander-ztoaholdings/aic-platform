'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import DashboardShell from '../components/DashboardShell';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { SectionCard } from '@/app/components/ui/Eyebrow';
import { TrialDrawer } from './TrialDrawer';
import { sameModel } from '@/lib/model-trials';

type Slice = { key: string; label: string; cost: number; requests: number; share: number };
type Flag = { kind: string; severity: 'warn' | 'info'; title: string; detail: string };
type Data = {
  last30: number; monthToDate: number; lastMonth: number; projected: number | null; budget: number | null;
  daily: { day: string; cost: number }[]; byProvider: Slice[]; byModel: Slice[]; bySystem: Slice[];
  flags: Flag[]; hasData: boolean; canManage: boolean;
  switches?: { advice: Advice[]; total: number; asOf: string; sources: { provider: string; url: string }[]; trials?: Trial[]; judges?: Record<string, string | null> };
};
type SwitchOption = { to: string; provider: string; tier: string; estimate: number; saving: number; savingShare: number; reason: string; kind: 'replacement' | 'same_provider' | 'other_provider'; promoUntil: string | null };
type Advice = {
  model: string; provider: string; matched: string | null; tier: string | null; cost: number; listEstimate: number | null; avgOutputTokens: number | null;
  ending: { on: string | null; status: 'deprecated' | 'retired'; daysLeft: number | null } | null; options: SwitchOption[];
};
type Trial = { fromModel: string; toModel: string; samples: number; asGood: number; worse: number; failed: number; createdAt: string; verdict: 'passed' | 'mixed' | 'failed'; sentence: string };
const TRIAL_TONE = { passed: 'text-[#2e7a57]', mixed: 'text-[#b45309]', failed: 'text-[#b23a35]' } as const;
const PROVIDER: Record<string, string> = { openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google', mistral: 'Mistral' };
const KIND: Record<SwitchOption['kind'], string> = { replacement: 'The provider’s replacement', same_provider: 'Same provider', other_provider: 'Another provider' };
const longDate = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

function Switches({ s }: { s: NonNullable<Data['switches']> }) {
  const shown = s.advice.filter((a) => a.ending || a.options.length);
  const unknown = s.advice.filter((a) => !a.matched);
  const [testing, setTesting] = useState<{ from: string; to: string; judge: string | null } | null>(null);
  const trialFor = (from: string, to: string) => (s.trials ?? []).find((t) => sameModel(t.fromModel, from) && sameModel(t.toModel, to)) ?? null;
  return (
    <SectionCard>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-[#0e1b2c]">Cheaper ways to run the same work</h2>
        {s.total >= 1 && <p className="text-[14px] text-[#0e1b2c]">Up to <span className="font-semibold text-[#2e7a57]">{usd(s.total)} a month</span> with the same provider</p>}
      </div>
      <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-[#5e6b7b]">Each figure is your last 30 days of tokens priced on another model. AIC never sees your prompts or answers, so the price alone cannot tell you whether a cheaper model is good enough. Test it on your own requests: the test runs on your machine and only the score comes back here.</p>
      {shown.length === 0 ? (
        <p className="mt-4 text-[14px] text-[#0e1b2c]">Nothing to suggest: each model you use is current, and nothing comparable is clearly cheaper for your mix of requests.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {shown.map((a) => (
            <li key={a.model} className="rounded-xl border border-[#eef1f5] p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[14.5px] font-semibold text-[#0e1b2c]">{a.model} <span className="font-normal text-[#5e6b7b]">from {PROVIDER[a.provider] ?? a.provider}</span></p>
                <p className="text-[13px] text-[#5e6b7b]">{usd(a.cost)} in the last 30 days</p>
              </div>
              {a.ending && (
                <p className="mt-2 flex gap-2 rounded-lg bg-[#b23a35]/[0.06] px-3 py-2 text-[13px] text-[#8f2d29]">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{a.ending.status === 'retired' ? `Retired${a.ending.on ? ` on ${longDate(a.ending.on)}` : ''}: requests to it may already be failing.` : `Stops working on ${a.ending.on ? longDate(a.ending.on) : 'a date the provider has announced'}${a.ending.daysLeft !== null && a.ending.daysLeft >= 0 ? `, ${a.ending.daysLeft} days from now` : ''}. Move before then.`}</span>
                </p>
              )}
              {a.options.length > 0 && (
                <ul className="mt-3 divide-y divide-[#eef1f5]">
                  {a.options.map((o) => (
                    <li key={o.to} className="grid gap-x-4 gap-y-1 py-2.5 md:grid-cols-[minmax(0,1fr)_auto]">
                      <div className="min-w-0">
                        <p className="text-[14px] text-[#0e1b2c]"><span className="font-medium">{o.to}</span> <span className="text-[12.5px] text-[#8a95a3]">{KIND[o.kind]}{o.kind === 'other_provider' ? `, ${PROVIDER[o.provider] ?? o.provider}` : ''}</span></p>
                        <p className="mt-0.5 text-[13px] leading-relaxed text-[#5e6b7b]">{o.reason}{o.promoUntil ? ` The price is promotional until ${longDate(o.promoUntil)} and rises after that.` : ''}</p>
                        {(() => {
                          const t = trialFor(a.model, o.to);
                          if (t) return <p className={`mt-1 text-[13px] font-medium ${TRIAL_TONE[t.verdict]}`}>Tested on {t.samples} of your requests on {new Date(t.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}: {t.sentence}</p>;
                          const judge = s.judges?.[`${a.model}|${o.to}`];
                          return judge !== undefined && judge !== null
                            ? <button type="button" onClick={() => setTesting({ from: a.model, to: o.to, judge })} className="mt-1 text-[13px] font-medium text-[#0e1b2c] underline decoration-[#a8772a] underline-offset-2">Test it on your own requests</button>
                            : null;
                        })()}
                      </div>
                      <div className="text-[13px] md:text-right">
                        <p className="text-[#0e1b2c]">About {usd(o.estimate)} a month</p>
                        <p className={o.saving > 0 ? 'font-medium text-[#2e7a57]' : 'text-[#b45309]'}>{o.saving > 0 ? `${usd(o.saving)} less (${Math.round(o.savingShare * 100)}%)` : `${usd(-o.saving)} more`}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      {unknown.length > 0 && <p className="mt-3 text-[12.5px] text-[#8a95a3]">Not in AIC’s price list yet, so not compared: {unknown.map((u) => u.model).join(', ')}.</p>}
      <p className="mt-3 text-[12.5px] text-[#8a95a3]">
        List prices from {[...new Set(s.sources.map((x) => x.provider))].map((p, i, arr) => {
          const src = s.sources.find((x) => x.provider === p)!;
          return <span key={p}>{i > 0 ? (i === arr.length - 1 ? ' and ' : ', ') : ''}<a href={src.url} target="_blank" rel="noreferrer" className="underline decoration-[#c9ced6] underline-offset-2 hover:text-[#0e1b2c]">{PROVIDER[p] ?? p}</a></span>;
        })}, checked {longDate(s.asOf)}. Batch, caching and negotiated discounts are not included.
      </p>
      {testing && <TrialDrawer from={testing.from} to={testing.to} judge={testing.judge} onClose={() => setTesting(null)} />}
    </SectionCard>
  );
}

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
                <span className="shrink-0 text-[#0e1b2c]">{usd(r.cost)} <span className="text-[#8a95a3]">({Math.round(r.share * 100)}%)</span></span>
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
      <div>
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

            {d.switches && <Switches s={d.switches} />}

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
