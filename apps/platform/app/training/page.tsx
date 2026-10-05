'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Circle, Clock } from 'lucide-react';
import DashboardShell from '../components/DashboardShell';
import { PageHeader } from '@/app/components/ui/PageHeader';

type Mod = { key: string; title: string; summary: string; minutes: number; audience: 'everyone' | 'reviewers'; version: string };
type Req = { key: string; required: boolean; everyMonths: number };
type State = { completedAt: string | null; score: number | null; current: boolean };
type Data = {
  modules: Mod[]; requirement: Req[]; chosen: boolean; mine: Record<string, State>;
  team: { id: string; name: string; jobTitle: string | null; modules: Record<string, State> }[] | null;
  canManage: boolean; isAdmin: boolean;
};

const date = (v: string | null) => (v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const chip = (on: boolean) => `inline-flex min-h-[34px] items-center rounded-full border px-3 text-[13px] font-medium transition-colors ${on ? 'border-[#0e1b2c] bg-[#0e1b2c] text-white' : 'border-[#dde2e8] bg-white text-[#0e1b2c] hover:border-[#a8772a]'}`;

function Settings({ d, onSaved }: { d: Data; onSaved: () => void }) {
  const [req, setReq] = useState<Req[]>(d.requirement);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const set = (key: string, patch: Partial<Req>) => setReq((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  async function save() {
    setBusy(true); setMsg('');
    const r = await fetch('/api/training', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requirement: req }) });
    setBusy(false);
    if (!r.ok) { setMsg((await r.json().catch(() => ({}))).error ?? 'Could not save.'); return; }
    setMsg('Saved.'); onSaved();
  }
  return (
    <section className="rounded-2xl border border-[#dde2e8] bg-white p-5">
      <h2 className="text-[15px] font-semibold text-[#0e1b2c]">What your organisation requires</h2>
      <p className="mt-0.5 text-[13px] text-[#5e6b7b]">{d.chosen ? 'Set by an administrator.' : 'These are the defaults until you save a choice.'}</p>
      <ul className="mt-4 space-y-3">
        {d.modules.map((m) => {
          const r = req.find((x) => x.key === m.key)!;
          return (
            <li key={m.key} className="border-t border-[#eef1f5] pt-3 first:border-0 first:pt-0">
              <label className="flex items-center gap-2.5 text-[14px] font-medium text-[#0e1b2c]">
                <input type="checkbox" checked={r.required} onChange={(e) => set(m.key, { required: e.target.checked })} className="h-4 w-4 accent-[#0e1b2c]" />{m.title}
              </label>
              {r.required && (
                <div className="mt-2 flex flex-wrap gap-1.5 pl-6">
                  {[6, 12, 24].map((n) => <button key={n} type="button" onClick={() => set(m.key, { everyMonths: n })} className={chip(r.everyMonths === n)}>Every {n} months</button>)}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex items-center gap-3">
        <button type="button" onClick={save} disabled={busy} className="inline-flex h-10 items-center rounded-full bg-[#0e1b2c] px-4 text-sm font-medium text-white hover:bg-[#22344a] disabled:opacity-40">{busy ? 'Saving…' : 'Save requirements'}</button>
        {msg && <span className="text-[13px] text-[#5e6b7b]">{msg}</span>}
      </div>
    </section>
  );
}

function Mark({ s, required }: { s: State; required: boolean }) {
  if (s.current) return <span title={`Passed ${date(s.completedAt)}`} className="inline-flex items-center gap-1 whitespace-nowrap text-[12.5px] text-[#2e7a57]"><CheckCircle2 className="h-4 w-4" /><span className="hidden lg:inline">{date(s.completedAt)}</span></span>;
  if (!required) return <span className="text-[12.5px] text-[#c9ced6]">Optional</span>;
  if (s.completedAt) return <span title={`Last passed ${date(s.completedAt)}`} className="inline-flex items-center gap-1 text-[12.5px] text-[#b45309]"><Clock className="h-4 w-4" /><span className="hidden lg:inline">Expired</span></span>;
  return <span className="inline-flex items-center gap-1 text-[12.5px] text-[#8a95a3]"><Circle className="h-4 w-4" /><span className="hidden lg:inline">Not taken</span></span>;
}

export default function TrainingPage() {
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    fetch('/api/training', { cache: 'no-store' }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setD(j); }).catch((e) => setError(e.message || 'Could not load training.'));
  }, []);
  useEffect(load, [load]);

  const req = (k: string) => d?.requirement.find((r) => r.key === k);
  const todo = d ? d.modules.filter((m) => req(m.key)?.required && !d.mine[m.key]?.current) : [];
  const teamTotals = d?.team ? (() => {
    let due = 0, ok = 0;
    for (const p of d.team!) for (const m of d.modules) if (req(m.key)?.required) { if (p.modules[m.key]?.current) ok++; else due++; }
    return { due, ok, total: due + ok };
  })() : null;

  return (
    <DashboardShell>
      <PageHeader
        eyebrow="Risk and people"
        title="Training"
        lede="Short modules on security, POPIA and using AI responsibly. Each takes about ten minutes and ends with four questions."
      />
      {error && <p className="text-sm text-[#b42318]">{error}</p>}
      {!d && !error && <p className="text-sm text-[#5e6b7b]">Loading…</p>}
      {d && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <section>
              <h2 className="text-[17px] font-semibold text-[#0e1b2c]">{todo.length ? `You have ${todo.length} module${todo.length === 1 ? '' : 's'} to complete` : 'You are up to date'}</h2>
              <ul className="mt-3 grid gap-3 md:grid-cols-2">
                {d.modules.map((m) => {
                  const s = d.mine[m.key];
                  const r = req(m.key);
                  return (
                    <li key={m.key} className="flex flex-col rounded-2xl border border-[#dde2e8] bg-white p-5">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-[16px] font-semibold text-[#0e1b2c]">{m.title}</h3>
                        {s.current ? <span className="shrink-0 rounded-full bg-[#2e7a57]/10 px-2.5 py-1 text-[12px] font-medium text-[#2e7a57]">Passed</span>
                          : r?.required ? <span className="shrink-0 rounded-full bg-[#b45309]/12 px-2.5 py-1 text-[12px] font-medium text-[#b45309]">{s.completedAt ? 'Due again' : 'Required'}</span>
                          : <span className="shrink-0 rounded-full bg-[#eef1f5] px-2.5 py-1 text-[12px] font-medium text-[#5e6b7b]">Optional</span>}
                      </div>
                      <p className="mt-1 flex-1 text-[14px] text-[#5e6b7b]">{m.summary}</p>
                      <p className="mt-3 text-[12.5px] text-[#8a95a3]">
                        About {m.minutes} minutes{m.audience === 'reviewers' ? ', for people who review automated decisions' : ''}
                        {s.completedAt ? `. Last passed ${date(s.completedAt)} with ${s.score}%` : ''}
                      </p>
                      <Link href={`/training/${m.key}`} className={`mt-3 inline-flex h-10 w-fit items-center rounded-full px-4 text-sm font-medium ${s.current ? 'border border-[#dde2e8] text-[#0e1b2c] hover:border-[#a8772a]' : 'bg-[#0e1b2c] text-white hover:bg-[#22344a]'}`}>
                        {s.current ? 'Take it again' : s.completedAt ? 'Retake module' : 'Start module'}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>

            {d.team && (
              <section className="rounded-2xl border border-[#dde2e8] bg-white">
                <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5">
                  <h2 className="text-[15px] font-semibold text-[#0e1b2c]">Everyone</h2>
                  {teamTotals && teamTotals.total > 0 && <p className="text-[13px] text-[#5e6b7b]">{teamTotals.ok} of {teamTotals.total} required completions up to date</p>}
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-[14px]">
                    <thead className="border-y border-[#eef1f5] text-[12.5px] text-[#8a95a3]">
                      <tr><th className="px-5 py-2.5 font-medium">Person</th>{d.modules.map((m) => <th key={m.key} className="px-3 py-2.5 font-medium">{m.title}</th>)}</tr>
                    </thead>
                    <tbody>
                      {d.team.map((p) => (
                        <tr key={p.id} className="border-b border-[#eef1f5] last:border-0">
                          <td className="px-5 py-2.5"><p className="font-medium text-[#0e1b2c]">{p.name}</p>{p.jobTitle && <p className="text-[12px] text-[#8a95a3]">{p.jobTitle}</p>}</td>
                          {d.modules.map((m) => <td key={m.key} className="px-3 py-2.5"><Mark s={p.modules[m.key]} required={!!req(m.key)?.required} /></td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
          <aside className="space-y-4">
            {d.isAdmin ? <Settings d={d} onSaved={load} /> : (
              <section className="rounded-2xl border border-[#dde2e8] bg-white p-5 text-[14px] text-[#5e6b7b]">
                <h2 className="text-[15px] font-semibold text-[#0e1b2c]">How this works</h2>
                <p className="mt-1">Read the module, then answer four questions. Three right is a pass. You can retake any module as often as you like.</p>
              </section>
            )}
            <section className="rounded-2xl border border-[#dde2e8] bg-white p-5 text-[13.5px] text-[#5e6b7b]">
              <h2 className="text-[15px] font-semibold text-[#0e1b2c]">What this evidences</h2>
              <p className="mt-1">Completions count towards security awareness in ISO 27001, SOC 2 and the AIC standard, and the AI module covers the AI literacy duty in Article 4 of the EU AI Act.</p>
            </section>
          </aside>
        </div>
      )}
    </DashboardShell>
  );
}
