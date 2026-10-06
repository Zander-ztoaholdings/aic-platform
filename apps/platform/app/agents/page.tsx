'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bot, Plus, X } from 'lucide-react';
import { Portal } from '@/app/components/ui/Portal';
import DashboardShell from '../components/DashboardShell';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { STATUS, RUN_STATUS, ToolsNotice } from './shared';
import { AGENT_MODELS, AGENT_PROVIDERS, PROVIDER_LABEL, type AgentProvider } from '@/lib/agents/config';

type Agent = {
  id: string; name: string; purpose: string | null; provider: AgentProvider; model: string; status: string; problems: string[];
  lastRun: { id: string; status: string; startedAt: string } | null; waiting: number;
};
type Data = { agents: Agent[]; notice: string; canManage: boolean };

const when = (v: string) => new Date(v).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const input = 'mt-1 h-11 w-full rounded-xl border border-[#dde2e8] px-3 text-[15px] font-normal outline-none focus:border-[#a8772a]';

function NewAgent({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [provider, setProvider] = useState<AgentProvider>('anthropic');
  const [model, setModel] = useState(AGENT_MODELS.anthropic[0].id);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function create() {
    setBusy(true); setErr('');
    const r = await fetch('/api/agents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, purpose, provider, model }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error ?? 'Could not create the agent.'); return; }
    router.push(`/agents/${j.id}`);
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Create an agent">
        <div className="absolute inset-0 bg-[#0a1728]/30" onClick={onClose} />
        <div className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-[-12px_0_40px_-12px_rgba(10,23,40,0.25)]">
          <div className="flex items-center justify-between border-b border-[#eef1f5] px-5 py-4">
            <h2 className="font-serif text-[20px] font-semibold text-[#0e1b2c]">Create an agent</h2>
            <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eef1f5]" aria-label="Close"><X className="h-4 w-4" /></button>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 text-[14px] font-medium text-[#0e1b2c]">
            <label className="block">Name<input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Claims triage" /></label>
            <label className="block">What it is for<textarea className={`${input} h-24 py-2`} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Reads new claims and sorts them for the claims team." /></label>
            <div>
              <p>Model provider</p>
              <div className="mt-1.5 flex gap-2">
                {AGENT_PROVIDERS.map((p) => (
                  <button key={p} type="button" onClick={() => { setProvider(p); setModel(AGENT_MODELS[p][0].id); }} className={`inline-flex h-10 items-center rounded-full border px-4 text-[14px] ${provider === p ? 'border-[#0e1b2c] bg-[#0e1b2c] text-white' : 'border-[#dde2e8] text-[#0e1b2c] hover:border-[#a8772a]'}`}>{PROVIDER_LABEL[p]}</button>
                ))}
              </div>
            </div>
            <label className="block">Model
              <select className={input} value={model} onChange={(e) => setModel(e.target.value)}>
                {AGENT_MODELS[provider].map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </label>
            <p className="text-[13px] font-normal text-[#5e6b7b]">The agent runs with your own {PROVIDER_LABEL[provider]} key, which you add next. It starts as a draft and does nothing until you switch it on.</p>
            {err && <p className="text-[13px] font-normal text-[#b23a35]">{err}</p>}
          </div>
          <div className="border-t border-[#eef1f5] px-5 py-4">
            <button type="button" disabled={busy || name.trim().length < 2} onClick={create} className="inline-flex h-11 items-center rounded-full bg-[#0e1b2c] px-5 text-sm font-medium text-white hover:bg-[#22344a] disabled:opacity-40">{busy ? 'Creating…' : 'Create the agent'}</button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

export default function AgentsPage() {
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  // From the dashboard shortcut: /agents?new=1 opens "Create an agent" straight away.
  useEffect(() => {
    if (d?.canManage && new URLSearchParams(window.location.search).get('new') === '1') { setOpen(true); window.history.replaceState(null, '', '/agents'); }
  }, [d?.canManage]);

  const load = useCallback(() => {
    fetch('/api/agents', { cache: 'no-store' }).then(async (r) => {
      const j = await r.json().catch(() => ({}));
      if (r.ok) setD(j); else setError(j.error ?? 'Could not load agents.');
    });
  }, []);
  useEffect(load, [load]);

  return (
    <DashboardShell>
      <PageHeader
        eyebrow="Tools"
        title="Agents"
        lede="Run your AI agents from AIC with their reach fixed in advance: which addresses they may call, what needs a person’s approval, and how much they may spend. Every step is recorded."
        actions={d?.canManage ? <button type="button" onClick={() => setOpen(true)} className="inline-flex h-11 items-center gap-1.5 rounded-full bg-[#0e1b2c] px-5 text-sm font-medium text-white hover:bg-[#22344a]"><Plus className="h-4 w-4" />Create an agent</button> : undefined}
      />
      {error && <p className="text-sm text-[#b23a35]">{error}</p>}
      {!d && !error && <p className="text-sm text-[#5e6b7b]">Loading…</p>}
      {d && (
        <div className="space-y-5">
          <ToolsNotice text={d.notice} />
          {d.agents.length === 0 ? (
            <div className="rounded-2xl border border-[#dde2e8] bg-white p-6">
              <p className="text-[15px] font-medium text-[#0e1b2c]">No agents yet.</p>
              <p className="mt-1 max-w-2xl text-[14px] text-[#5e6b7b]">An agent here is a model, your instructions, and a short list of tools: web addresses it may call, a way to ask a person, and a way to record a decision in your decision log. AIC checks every call against those limits before it leaves.</p>
            </div>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {d.agents.map((a) => (
                <li key={a.id}>
                  <Link href={`/agents/${a.id}`} className="block h-full rounded-2xl border border-[#dde2e8] bg-white p-5 hover:border-[#a8772a]">
                    <div className="flex items-start justify-between gap-3">
                      <p className="flex items-center gap-2 text-[16px] font-semibold text-[#0e1b2c]"><Bot className="h-4.5 w-4.5 text-[#a8772a]" />{a.name}</p>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12.5px] font-medium ${STATUS[a.status]?.tone ?? ''}`}>{STATUS[a.status]?.label ?? a.status}</span>
                    </div>
                    {a.purpose && <p className="mt-1.5 line-clamp-2 text-[14px] text-[#5e6b7b]">{a.purpose}</p>}
                    <p className="mt-3 text-[13px] text-[#8a95a3]">{PROVIDER_LABEL[a.provider]}, {a.model}</p>
                    <p className="mt-1 text-[13px]">
                      {a.waiting > 0 ? <span className="font-medium text-[#b45309]">{a.waiting} {a.waiting === 1 ? 'run is' : 'runs are'} waiting for a person</span>
                        : a.lastRun ? <span className="text-[#5e6b7b]">Last run {when(a.lastRun.startedAt)}: {RUN_STATUS[a.lastRun.status]?.label.toLowerCase() ?? a.lastRun.status}</span>
                        : a.status === 'draft' && a.problems.length ? <span className="text-[#5e6b7b]">{a.problems[0]}</span>
                        : <span className="text-[#8a95a3]">Not run yet</span>}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {open && <NewAgent onClose={() => setOpen(false)} />}
    </DashboardShell>
  );
}
