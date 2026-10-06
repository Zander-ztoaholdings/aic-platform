'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Plus, Upload, X } from 'lucide-react';
import { Portal } from '@/app/components/ui/Portal';
import DashboardShell from '../components/DashboardShell';
import { PageHeader } from '@/app/components/ui/PageHeader';

type Acc = { system: string; account: string; enabled: boolean; privilege: string | null };
type Person = {
  id: string; name: string; email: string | null; jobTitle: string | null; department: string | null;
  startDate: string | null; endDate: string | null; source: string; state: 'left' | 'joining' | 'current'; accounts: Acc[] | null;
};
type Data = { people: Person[]; canManage: boolean; notes: string[]; checkedAccounts: boolean };

const date = (v: string | null) => (v ? new Date(v + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '');
const input = 'mt-1 h-11 w-full rounded-xl border border-[#dde2e8] px-3 text-[15px] font-normal outline-none focus:border-[#a8772a]';
const STATE: Record<Person['state'], { label: string; tone: string }> = {
  current: { label: 'Current', tone: 'bg-[#eef1f5] text-[#5e6b7b]' },
  joining: { label: 'Joining', tone: 'bg-[#a8772a]/12 text-[#8a6a1f]' },
  left: { label: 'Left', tone: 'bg-[#0e1b2c]/[0.06] text-[#0e1b2c]' },
};

type Form = { name: string; email: string; jobTitle: string; department: string; startDate: string; endDate: string };
const toForm = (p: Person | null): Form => ({ name: p?.name ?? '', email: p?.email ?? '', jobTitle: p?.jobTitle ?? '', department: p?.department ?? '', startDate: p?.startDate ?? '', endDate: p?.endDate ?? '' });

function Drawer({ person, onClose, onSaved }: { person: Person | null; onClose: () => void; onSaved: () => void }) {
  const [mode, setMode] = useState<'one' | 'csv'>('one');
  const [f, setF] = useState<Form>(() => toForm(person));
  const [csv, setCsv] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = <K extends keyof Form>(k: K, v: string) => setF((x) => ({ ...x, [k]: v }));

  async function send(url: string, method: string, body: unknown) {
    setBusy(true); setErr('');
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error ?? 'Could not save.'); return; }
    onSaved();
  }
  async function readFile(file: File) { setCsv(await file.text()); }

  return (
    <Portal>
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={person ? person.name : 'Add people'}>
      <div className="absolute inset-0 bg-[#0a1728]/30" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-lg flex-col bg-white shadow-[-12px_0_40px_-12px_rgba(10,23,40,0.25)]">
        <div className="flex items-center justify-between border-b border-[#eef1f5] px-5 py-4">
          <h2 className="font-serif text-[20px] font-semibold text-[#0e1b2c]">{person ? person.name : 'Add people'}</h2>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eef1f5]" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        {!person && (
          <div className="flex gap-1 border-b border-[#eef1f5] px-5 pt-2">
            {([['one', 'One person'], ['csv', 'From a spreadsheet']] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setMode(k)} className={`h-10 border-b-2 px-3 text-[14px] font-medium ${mode === k ? 'border-[#a8772a] text-[#0e1b2c]' : 'border-transparent text-[#5e6b7b] hover:text-[#0e1b2c]'}`}>{l}</button>
            ))}
          </div>
        )}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {(person || mode === 'one') ? (
            <>
              <label className="block text-[13px] font-medium text-[#0e1b2c]">Name<input value={f.name} onChange={(e) => set('name', e.target.value)} className={input} /></label>
              <label className="block text-[13px] font-medium text-[#0e1b2c]">Work email<input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} className={input} /></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-[13px] font-medium text-[#0e1b2c]">Job title<input value={f.jobTitle} onChange={(e) => set('jobTitle', e.target.value)} className={input} /></label>
                <label className="block text-[13px] font-medium text-[#0e1b2c]">Department<input value={f.department} onChange={(e) => set('department', e.target.value)} className={input} /></label>
                <label className="block text-[13px] font-medium text-[#0e1b2c]">Started<input type="date" value={f.startDate} onChange={(e) => set('startDate', e.target.value)} className={input} /></label>
                <label className="block text-[13px] font-medium text-[#0e1b2c]">Left <span className="font-normal text-[#8a95a3]">(if they have)</span><input type="date" value={f.endDate} onChange={(e) => set('endDate', e.target.value)} className={input} /></label>
              </div>
              <p className="text-[13px] text-[#5e6b7b]">When you add a leaving date, AIC checks the connected systems for accounts they still have.</p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button type="button" disabled={busy || f.name.trim().length < 2} onClick={() => send(person ? `/api/people/${person.id}` : '/api/people', person ? 'PATCH' : 'POST', f)}
                  className="inline-flex h-11 items-center rounded-full bg-[#0e1b2c] px-5 text-sm font-medium text-white hover:bg-[#22344a] disabled:opacity-40">{busy ? 'Saving…' : person ? 'Save changes' : 'Add person'}</button>
                {person && <button type="button" disabled={busy} onClick={() => send(`/api/people/${person.id}`, 'DELETE', undefined)} className="h-11 px-3 text-sm font-medium text-[#b23a35] hover:underline">Remove from the list</button>}
              </div>
            </>
          ) : (
            <>
              <p className="text-[14px] text-[#5e6b7b]">Export your staff list from payroll or HR as a CSV and choose it here, or paste it. AIC looks for columns called name, email, job title, department, start date and end date. Dates as YYYY-MM-DD. People already listed under the same email are skipped.</p>
              <label className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full border border-[#dde2e8] px-4 text-[14px] font-medium text-[#0e1b2c] hover:border-[#a8772a]">
                <Upload className="h-4 w-4" />Choose a CSV file
                <input type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
              </label>
              <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={10} placeholder={'name,email,job title,start date,end date\nThabo Nkosi,thabo@example.co.za,Analyst,2024-02-01,'} className="w-full rounded-xl border border-[#dde2e8] px-3 py-2 font-mono text-[13px] outline-none focus:border-[#a8772a]" />
              <button type="button" disabled={busy || csv.trim().split('\n').length < 2} onClick={() => send('/api/people', 'POST', { csv })}
                className="inline-flex h-11 items-center rounded-full bg-[#0e1b2c] px-5 text-sm font-medium text-white hover:bg-[#22344a] disabled:opacity-40">{busy ? 'Importing…' : 'Import people'}</button>
            </>
          )}
          {err && <p className="text-[13px] text-[#b23a35]">{err}</p>}
        </div>
      </div>
    </div>
    </Portal>
  );
}

export default function PeoplePage() {
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [filter, setFilter] = useState<'all' | 'current' | 'joining' | 'left'>('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Person | 'new' | null>(null);

  const load = useCallback((accounts = false) => {
    if (accounts) setChecking(true);
    fetch(`/api/people${accounts ? '?accounts=1' : ''}`, { cache: 'no-store' })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setD(j); })
      .catch((e) => setError(e.message || 'Could not load people.'))
      .finally(() => setChecking(false));
  }, []);
  useEffect(() => load(true), [load]);

  const people = d?.people ?? [];
  const stillIn = people.filter((p) => p.state === 'left' && (p.accounts ?? []).some((a) => a.enabled));
  const shown = useMemo(() => people.filter((p) => (filter === 'all' || p.state === filter) && (!q || `${p.name} ${p.email ?? ''} ${p.jobTitle ?? ''} ${p.department ?? ''}`.toLowerCase().includes(q.toLowerCase()))), [people, filter, q]);
  const count = (s: Person['state']) => people.filter((p) => p.state === s).length;

  return (
    <DashboardShell>
      <PageHeader
        eyebrow="Risk and people"
        title="People"
        lede="Who works for you, who is joining and who has left. AIC matches each person to their accounts in the connected systems, so a leaver who still has access is caught."
        actions={d?.canManage ? <button type="button" onClick={() => setOpen('new')} className="inline-flex h-11 items-center gap-1.5 rounded-full bg-[#0e1b2c] px-5 text-sm font-medium text-white hover:bg-[#22344a]"><Plus className="h-4 w-4" />Add people</button> : undefined}
      />
      {error && <p className="text-sm text-[#b42318]">{error}</p>}
      {!d && !error && <p className="text-sm text-[#5e6b7b]">Checking accounts…</p>}
      {d && (
        <div className="space-y-5">
          {stillIn.length > 0 && (
            <section className="rounded-2xl border border-[#b23a35]/25 bg-[#b23a35]/[0.04] p-5">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[#8f2d29]"><AlertTriangle className="h-4 w-4" />{stillIn.length} {stillIn.length === 1 ? 'person who has left still has' : 'people who have left still have'} access</h2>
              <ul className="mt-2 space-y-1 text-[14px] text-[#0e1b2c]">
                {stillIn.map((p) => <li key={p.id}><span className="font-medium">{p.name}</span> <span className="text-[#5e6b7b]">left {date(p.endDate)}, still in {p.accounts!.filter((a) => a.enabled).map((a) => `${a.system}${a.privilege && /admin|owner/i.test(a.privilege) ? ` as ${a.privilege.toLowerCase()}` : ''}`).join(', ')}</span></li>)}
              </ul>
              <p className="mt-2 text-[13px] text-[#5e6b7b]">Disable these accounts in each system. Until then the leavers control shows a gap.</p>
            </section>
          )}
          {d.notes.length > 0 && <div className="rounded-xl border border-[#b45309]/25 bg-[#b45309]/[0.05] px-4 py-3 text-[13.5px] text-[#8a4a10]">{d.notes.map((n) => <p key={n}>{n}</p>)}</div>}
          {people.length === 0 ? (
            <div className="rounded-2xl border border-[#dde2e8] bg-white p-6">
              <p className="text-[15px] font-medium text-[#0e1b2c]">No one listed yet.</p>
              <p className="mt-1 max-w-2xl text-[14px] text-[#5e6b7b]">Import your staff list from payroll or HR. Once a person has a leaving date, AIC checks Microsoft 365, Google Workspace, GitHub and your other connected systems for accounts they still hold.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {([['all', `Everyone (${people.length})`], ['current', `Current (${count('current')})`], ['joining', `Joining (${count('joining')})`], ['left', `Left (${count('left')})`]] as const).map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setFilter(k)} className={`inline-flex min-h-[34px] items-center rounded-full border px-3 text-[13px] font-medium ${filter === k ? 'border-[#0e1b2c] bg-[#0e1b2c] text-white' : 'border-[#dde2e8] bg-white text-[#0e1b2c] hover:border-[#a8772a]'}`}>{l}</button>
                ))}
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, email or team" aria-label="Search people" className="h-9 min-w-[220px] flex-1 rounded-full border border-[#dde2e8] bg-white px-4 text-[14px] outline-none focus:border-[#a8772a] md:max-w-xs md:flex-none" />
                <button type="button" onClick={() => load(true)} disabled={checking} className="ml-auto inline-flex h-9 items-center rounded-full border border-[#dde2e8] bg-white px-3.5 text-[13px] font-medium text-[#0e1b2c] hover:border-[#a8772a] disabled:opacity-50">{checking ? 'Checking…' : 'Check accounts again'}</button>
              </div>
              <div className="overflow-hidden rounded-2xl border border-[#dde2e8] bg-white">
                <ul className="divide-y divide-[#eef1f5]">
                  {shown.map((p) => {
                    const live = (p.accounts ?? []).filter((a) => a.enabled);
                    const bad = p.state === 'left' && live.length > 0;
                    return (
                      <li key={p.id}>
                        <button type="button" onClick={() => d.canManage && setOpen(p)} className={`grid w-full gap-x-4 gap-y-1 px-4 py-3 text-left md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.2fr)_180px] md:items-center ${d.canManage ? 'hover:bg-[#f5f7f9]' : 'cursor-default'}`}>
                          <span className="min-w-0">
                            <span className="block truncate text-[14.5px] font-medium text-[#0e1b2c]">{p.name}</span>
                            <span className="block truncate text-[12.5px] text-[#5e6b7b]">{p.email ?? 'No email'}</span>
                          </span>
                          <span className="min-w-0 truncate text-[13px] text-[#5e6b7b]">{[p.jobTitle, p.department].filter(Boolean).join(', ') || ' '}</span>
                          <span className={`min-w-0 text-[13px] ${bad ? 'font-medium text-[#b23a35]' : 'text-[#5e6b7b]'}`}>
                            {p.accounts === null ? '' : live.length ? `${bad ? 'Still in ' : ''}${[...new Set(live.map((a) => a.system))].join(', ')}` : p.state === 'left' ? 'No remaining access' : 'No matching accounts'}
                          </span>
                          <span className="flex items-center gap-2 md:justify-end">
                            <span className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${STATE[p.state].tone}`}>{STATE[p.state].label}</span>
                            <span className="text-[12px] text-[#8a95a3]">{p.state === 'left' ? date(p.endDate) : p.state === 'joining' ? date(p.startDate) : ''}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                  {shown.length === 0 && <li className="px-4 py-5 text-[14px] text-[#5e6b7b]">Nobody matches.</li>}
                </ul>
              </div>
            </>
          )}
        </div>
      )}
      {open && <Drawer person={open === 'new' ? null : open} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); load(true); }} />}
    </DashboardShell>
  );
}
