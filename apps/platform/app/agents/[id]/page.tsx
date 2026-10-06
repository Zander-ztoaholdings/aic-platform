'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Copy, Pause, Play, Plus, Trash2 } from 'lucide-react';
import DashboardShell from '../../components/DashboardShell';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { STATUS, RUN_STATUS, ToolsNotice } from '../shared';
import { SharePointTools, blankSp, type SpForm, type SpSetup } from './SharePointTools';
import {
  AGENT_MODELS, AGENT_PROVIDERS, PROVIDER_LABEL, APPROVAL_LABEL, HTTP_METHODS, LIMIT_RANGE,
  type AgentProvider, type AgentLimits, type Approval, type HttpMethod,
} from '@/lib/agents/config';

type HttpToolView = { kind: 'http'; name: string; description: string; baseUrl: string; methods: HttpMethod[]; pathPrefixes: string[]; approval: Approval; secretHeaders: string[]; secretsSet?: string[] };
type SpToolView = Omit<SpForm, 'saved'>;
type ToolView = HttpToolView | SpToolView | { kind: 'ask_a_person'; name: 'ask_a_person' } | { kind: 'record_decision'; name: 'record_decision' };
type Agent = {
  id: string; name: string; purpose: string | null; ownerUserId: string | null; aiSystemId: string | null; provider: AgentProvider; model: string;
  instructions: string; tools: ToolView[]; limits: AgentLimits; status: string; modelKeyHint: string | null; version: number; problems: string[];
};
type Data = { agent: Agent; notice: string; canManage: boolean; isAdmin: boolean; sharePoint: SpSetup; encryption: boolean; people: { id: string; name: string; email: string }[]; systems: { id: string; name: string }[] };
type Run = { id: string; status: string; trigger: string; input: string; steps: number; costUsd: string; startedAt: string; agentVersion: number };

type HttpForm = Omit<HttpToolView, 'pathPrefixes' | 'secretsSet'> & { paths: string; secrets: Record<string, string>; secretsSet: string[] };
type Form = {
  name: string; purpose: string; provider: AgentProvider; model: string; ownerUserId: string; aiSystemId: string; instructions: string;
  ask: boolean; decide: boolean; http: HttpForm[]; sp: SpForm[]; limits: { maxSteps: string; maxTokensPerRun: string; maxRunsPerDay: string; monthlyBudgetUsd: string }; modelKey: string;
};

const toForm = (a: Agent): Form => ({
  name: a.name, purpose: a.purpose ?? '', provider: a.provider, model: a.model, ownerUserId: a.ownerUserId ?? '', aiSystemId: a.aiSystemId ?? '', instructions: a.instructions,
  ask: a.tools.some((t) => t.kind === 'ask_a_person'), decide: a.tools.some((t) => t.kind === 'record_decision'),
  http: a.tools.filter((t): t is HttpToolView => t.kind === 'http').map((t) => ({ ...t, paths: t.pathPrefixes.join('\n'), secrets: {}, secretsSet: t.secretsSet ?? [] })),
  sp: a.tools.filter((t): t is SpToolView => t.kind === 'sharepoint').map((t) => ({ ...t, folder: t.folder ?? '', saved: true })),
  limits: { maxSteps: String(a.limits.maxSteps ?? 10), maxTokensPerRun: String(a.limits.maxTokensPerRun ?? 60000), maxRunsPerDay: String(a.limits.maxRunsPerDay ?? 200), monthlyBudgetUsd: a.limits.monthlyBudgetUsd == null ? '' : String(a.limits.monthlyBudgetUsd) },
  modelKey: '',
});

const input = 'mt-1 h-11 w-full rounded-xl border border-[#dde2e8] bg-white px-3 text-[15px] font-normal text-[#0e1b2c] outline-none focus:border-[#a8772a] disabled:bg-[#f5f7f9]';
const chip = (on: boolean) => `inline-flex min-h-[36px] items-center rounded-full border px-3 text-[13px] font-medium ${on ? 'border-[#0e1b2c] bg-[#0e1b2c] text-white' : 'border-[#dde2e8] bg-white text-[#0e1b2c] hover:border-[#a8772a]'}`;
const when = (v: string) => new Date(v).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const TABS = [['setup', 'Set up'], ['tools', 'Tools'], ['limits', 'Limits'], ['runs', 'Runs'], ['connect', 'Run it from your systems']] as const;
type Tab = (typeof TABS)[number][0];

const blankTool = (): HttpForm => ({ kind: 'http', name: '', description: '', baseUrl: 'https://', methods: ['GET'], approval: 'writes', secretHeaders: [], paths: '', secrets: {}, secretsSet: [] });

export default function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [d, setD] = useState<Data | null>(null);
  const [f, setF] = useState<Form | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [tab, setTab] = useState<Tab>('setup');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [task, setTask] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/agents/${id}`, { cache: 'no-store' }).then(async (r) => {
      const j = await r.json().catch(() => ({}));
      if (r.ok) { setD(j); setF(toForm(j.agent)); } else setMsg({ ok: false, text: j.error ?? 'Could not load the agent.' });
    });
    fetch(`/api/agents/${id}/runs`, { cache: 'no-store' }).then(async (r) => { if (r.ok) setRuns((await r.json()).runs); });
  }, [id]);
  useEffect(load, [load]);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('sharepoint');
    const text: Record<string, { ok: boolean; text: string }> = {
      connected: { ok: true, text: 'Microsoft 365 is connected. Your administrator now gives AIC the site (the steps are on the Tools tab), then press Check access.' },
      declined: { ok: false, text: 'Microsoft 365 was not connected: the consent was declined.' },
      permission: { ok: false, text: 'Only an organisation admin can connect Microsoft 365.' },
      state: { ok: false, text: 'That connection link had expired. Start again.' },
      failed: { ok: false, text: 'Microsoft did not confirm the consent. Try again, signed in as a global administrator.' },
      wrongtenant: { ok: false, text: 'The person who signed in is not a member of the organisation that consented, so AIC did not connect it. Sign in with an account from that organisation.' },
    };
    if (q && text[q]) { setMsg(text[q]); setTab('tools'); window.history.replaceState(null, '', window.location.pathname); }
  }, []);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => (x ? { ...x, [k]: v } : x));
  const setTool = (i: number, patch: Partial<HttpForm>) => setF((x) => (x ? { ...x, http: x.http.map((t, j) => (j === i ? { ...t, ...patch } : t)) } : x));

  async function patch(body: Record<string, unknown>, done: string) {
    setBusy(true); setMsg(null);
    const r = await fetch(`/api/agents/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: j.error ?? 'Could not save.' }); return false; }
    setD((x) => (x ? { ...x, agent: j.agent } : x));
    setF(toForm(j.agent));
    setMsg({ ok: true, text: done });
    return true;
  }

  function configBody(x: Form) {
    return {
      name: x.name, purpose: x.purpose, provider: x.provider, model: x.model, instructions: x.instructions,
      ownerUserId: x.ownerUserId || null, aiSystemId: x.aiSystemId || null,
      tools: [
        ...(x.ask ? [{ kind: 'ask_a_person' }] : []),
        ...(x.decide ? [{ kind: 'record_decision' }] : []),
        ...x.sp.map((t) => ({ kind: 'sharepoint', name: t.name, description: t.description, tenantId: t.tenantId, siteUrl: t.siteUrl, library: t.library, folder: t.folder, access: t.access, approval: t.approval })),
        ...x.http.map((t) => ({ kind: 'http', name: t.name, description: t.description, baseUrl: t.baseUrl, methods: t.methods, approval: t.approval, secretHeaders: t.secretHeaders.filter(Boolean), pathPrefixes: t.paths.split('\n').map((p) => p.trim()).filter(Boolean) })),
      ],
      limits: { maxSteps: x.limits.maxSteps, maxTokensPerRun: x.limits.maxTokensPerRun, maxRunsPerDay: x.limits.maxRunsPerDay, monthlyBudgetUsd: x.limits.monthlyBudgetUsd === '' ? null : x.limits.monthlyBudgetUsd },
    };
  }

  async function save() {
    if (!f) return false;
    const toolSecrets: Record<string, Record<string, string>> = {};
    for (const t of f.http) for (const [h, v] of Object.entries(t.secrets)) if (v) (toolSecrets[t.name] ??= {})[h] = v;
    return patch({ ...configBody(f), ...(f.modelKey ? { modelKey: f.modelKey } : {}), ...(Object.keys(toolSecrets).length ? { toolSecrets } : {}) }, 'Saved.');
  }

  async function run() {
    setBusy(true); setMsg(null);
    const r = await fetch(`/api/agents/${id}/runs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: task }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: j.error ?? 'Could not start the run.' }); return; }
    router.push(`/agents/${id}/runs/${j.run.id}`);
  }

  async function archive() {
    if (!d) return;
    setBusy(true);
    const r = await fetch(`/api/agents/${id}`, { method: 'DELETE' });
    setBusy(false);
    if (r.ok) router.push('/agents');
  }

  const a = d?.agent;
  const edit = !!d?.canManage;
  const snippet = `curl -X POST ${typeof window === 'undefined' ? '' : window.location.origin}/api/agents/${id}/runs \\
  -H "Authorization: Bearer aic_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{"input": "Sort the claims received since 08:00"}'`;

  return (
    <DashboardShell>
      <Link href="/agents" className="mb-3 inline-flex items-center gap-1.5 text-[14px] text-[#5e6b7b] hover:text-[#0e1b2c]"><ArrowLeft className="h-4 w-4" />All agents</Link>
      <PageHeader
        eyebrow="Tools"
        title={a ? <span className="inline-flex flex-wrap items-center gap-3">{a.name}<span className={`rounded-full px-2.5 py-0.5 font-sans text-[13px] font-medium ${STATUS[a.status]?.tone ?? ''}`}>{STATUS[a.status]?.label ?? a.status}</span></span> : 'Agent'}
        lede={a?.purpose ?? undefined}
        actions={a && edit ? (
          a.status === 'active'
            ? <button type="button" disabled={busy} onClick={() => patch({ status: 'paused' }, 'Paused. Runs in progress stop at their next step.')} className="inline-flex h-11 items-center gap-1.5 rounded-full border border-[#dde2e8] bg-white px-5 text-sm font-medium text-[#0e1b2c] hover:border-[#a8772a]"><Pause className="h-4 w-4" />Pause the agent</button>
            : <button type="button" disabled={busy} onClick={() => patch({ status: 'active' }, 'Switched on.')} className="inline-flex h-11 items-center gap-1.5 rounded-full bg-[#0e1b2c] px-5 text-sm font-medium text-white hover:bg-[#22344a] disabled:opacity-40"><Play className="h-4 w-4" />Switch it on</button>
        ) : undefined}
      />
      {msg && <p className={`mb-4 text-[14px] ${msg.ok ? 'text-[#2e7a57]' : 'text-[#b23a35]'}`}>{msg.text}</p>}
      {!d && !msg && <p className="text-sm text-[#5e6b7b]">Loading…</p>}
      {a && f && d && (
        <div className="space-y-5">
          <ToolsNotice text={d.notice} />
          {a.problems.length > 0 && (
            <div className="rounded-xl border border-[#b45309]/30 bg-[#b45309]/[0.05] p-4 text-[14px] text-[#8a4a10]">
              <p className="font-medium">Before it can be switched on</p>
              <ul className="mt-1 ml-4 list-disc">{a.problems.map((p) => <li key={p}>{p}</li>)}</ul>
            </div>
          )}
          {a.status === 'active' && edit && (
            <section className="rounded-2xl border border-[#dde2e8] bg-white p-5">
              <h2 className="text-[15px] font-semibold text-[#0e1b2c]">Give it a task</h2>
              <textarea className={`${input} h-24 py-2`} value={task} onChange={(e) => setTask(e.target.value)} placeholder="What should the agent do this time?" />
              <button type="button" disabled={busy || !task.trim()} onClick={run} className="mt-3 inline-flex h-11 items-center gap-1.5 rounded-full bg-[#0e1b2c] px-5 text-sm font-medium text-white hover:bg-[#22344a] disabled:opacity-40"><Play className="h-4 w-4" />{busy ? 'Running…' : 'Start the run'}</button>
            </section>
          )}

          <div className="flex gap-1 overflow-x-auto border-b border-[#dde2e8]">
            {TABS.map(([k, l]) => <button key={k} type="button" onClick={() => setTab(k)} className={`h-11 shrink-0 border-b-2 px-3 text-[14px] font-medium ${tab === k ? 'border-[#a8772a] text-[#0e1b2c]' : 'border-transparent text-[#5e6b7b] hover:text-[#0e1b2c]'}`}>{l}</button>)}
          </div>

          {tab === 'setup' && (
            <section className="grid gap-4 rounded-2xl border border-[#dde2e8] bg-white p-5 text-[14px] font-medium text-[#0e1b2c] md:grid-cols-2">
              <label className="block">Name<input className={input} disabled={!edit} value={f.name} onChange={(e) => set('name', e.target.value)} /></label>
              <label className="block">Accountable person
                <select className={input} disabled={!edit} value={f.ownerUserId} onChange={(e) => set('ownerUserId', e.target.value)}>
                  <option value="">Choose someone</option>
                  {d.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <label className="block md:col-span-2">What it is for<input className={input} disabled={!edit} value={f.purpose} onChange={(e) => set('purpose', e.target.value)} /></label>
              <label className="block">Model provider
                <select className={input} disabled={!edit} value={f.provider} onChange={(e) => { const p = e.target.value as AgentProvider; setF((x) => (x ? { ...x, provider: p, model: AGENT_MODELS[p][0].id } : x)); }}>
                  {AGENT_PROVIDERS.map((p) => <option key={p} value={p}>{PROVIDER_LABEL[p]}</option>)}
                </select>
              </label>
              <label className="block">Model
                <select className={input} disabled={!edit} value={f.model} onChange={(e) => set('model', e.target.value)}>
                  {[...AGENT_MODELS[f.provider], ...(AGENT_MODELS[f.provider].some((m) => m.id === f.model) ? [] : [{ id: f.model, label: f.model }])].map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </label>
              <label className="block md:col-span-2">{PROVIDER_LABEL[f.provider]} key
                <input type="password" autoComplete="off" className={input} disabled={!edit || !d.encryption} value={f.modelKey} onChange={(e) => set('modelKey', e.target.value)} placeholder={a.modelKeyHint && a.provider === f.provider ? `Saved, ending ${a.modelKeyHint.replace('…', '')}. Paste a new one to replace it.` : 'Paste the key the agent should run with'} />
                <span className="mt-1 block text-[12.5px] font-normal text-[#5e6b7b]">{d.encryption ? 'Kept encrypted. AIC uses it only to run this agent, and never shows it again. A key limited to this use is best.' : 'This AIC server cannot store keys yet.'}</span>
              </label>
              <label className="block md:col-span-2">Linked AI system
                <select className={input} disabled={!edit} value={f.aiSystemId} onChange={(e) => set('aiSystemId', e.target.value)}>
                  <option value="">Not linked</option>
                  {d.systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <span className="mt-1 block text-[12.5px] font-normal text-[#5e6b7b]">Decisions the agent records go into this system’s decision log.</span>
              </label>
              <label className="block md:col-span-2">Instructions
                <textarea className={`${input} h-56 py-2 leading-relaxed`} disabled={!edit} value={f.instructions} onChange={(e) => set('instructions', e.target.value)} placeholder="What the agent does, how it should decide, and when it must ask a person." />
              </label>
              {edit && <div className="md:col-span-2"><button type="button" disabled={busy} onClick={save} className="inline-flex h-11 items-center rounded-full bg-[#0e1b2c] px-5 text-sm font-medium text-white hover:bg-[#22344a] disabled:opacity-40">{busy ? 'Saving…' : 'Save changes'}</button></div>}
            </section>
          )}

          {tab === 'tools' && (
            <section className="space-y-4">
              <div className="rounded-2xl border border-[#dde2e8] bg-white p-5 text-[14px] text-[#0e1b2c]">
                <h2 className="text-[15px] font-semibold">Built in</h2>
                <label className="mt-3 flex items-start gap-3"><input type="checkbox" className="mt-1 h-4 w-4 accent-[#0e1b2c]" disabled={!edit} checked={f.ask} onChange={(e) => set('ask', e.target.checked)} /><span><span className="font-medium">Ask a person</span><span className="block text-[13.5px] text-[#5e6b7b]">The run waits until the accountable person, or anyone who can manage compliance, answers in AIC.</span></span></label>
                <label className="mt-3 flex items-start gap-3"><input type="checkbox" className="mt-1 h-4 w-4 accent-[#0e1b2c]" disabled={!edit} checked={f.decide} onChange={(e) => set('decide', e.target.checked)} /><span><span className="font-medium">Record decisions</span><span className="block text-[13.5px] text-[#5e6b7b]">Decisions the agent makes about a person or case go into your decision log, on the same ledger as the rest.</span></span></label>
              </div>
              <SharePointTools
                agentId={id} tools={f.sp} setTools={(sp) => set('sp', sp)} setup={d.sharePoint} edit={edit} isAdmin={d.isAdmin}
                dirty={f.sp.some((t) => !t.saved)} onSaveFirst={save}
              />
              {f.http.map((t, i) => (
                <div key={i} className="grid gap-4 rounded-2xl border border-[#dde2e8] bg-white p-5 text-[14px] font-medium text-[#0e1b2c] md:grid-cols-2">
                  <label className="block">Tool name<input className={input} disabled={!edit} value={t.name} onChange={(e) => setTool(i, { name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} placeholder="claims_api" /></label>
                  <label className="block">Address<input className={input} disabled={!edit} value={t.baseUrl} onChange={(e) => setTool(i, { baseUrl: e.target.value })} placeholder="https://api.example.co.za/v1" /></label>
                  <label className="block md:col-span-2">What it is for<input className={input} disabled={!edit} value={t.description} onChange={(e) => setTool(i, { description: e.target.value })} placeholder="Reads and updates claims in the claims system." /></label>
                  <div className="md:col-span-2">
                    <p>Methods it may use</p>
                    <div className="mt-1.5 flex flex-wrap gap-2">{HTTP_METHODS.map((m) => <button key={m} type="button" disabled={!edit} onClick={() => setTool(i, { methods: t.methods.includes(m) ? t.methods.filter((x) => x !== m) : [...t.methods, m] })} className={chip(t.methods.includes(m))}>{m}</button>)}</div>
                  </div>
                  <label className="block">Paths it may use, one per line
                    <textarea className={`${input} h-24 py-2`} disabled={!edit} value={t.paths} onChange={(e) => setTool(i, { paths: e.target.value })} placeholder={'/claims\n/policies'} />
                    <span className="mt-1 block text-[12.5px] font-normal text-[#5e6b7b]">Leave empty to allow any path under the address.</span>
                  </label>
                  <div>
                    <p>Who approves</p>
                    <div className="mt-1.5 space-y-1.5">{(Object.keys(APPROVAL_LABEL) as Approval[]).map((k) => <label key={k} className="flex items-center gap-2 font-normal"><input type="radio" className="accent-[#0e1b2c]" disabled={!edit} checked={t.approval === k} onChange={() => setTool(i, { approval: k })} />{APPROVAL_LABEL[k]}</label>)}</div>
                  </div>
                  <div className="md:col-span-2">
                    <p>Secret headers</p>
                    <p className="text-[12.5px] font-normal text-[#5e6b7b]">For an API key or token. AIC adds them to each call; the model never sees them.</p>
                    {t.secretHeaders.map((h, k) => (
                      <div key={k} className="mt-2 flex flex-wrap gap-2">
                        <input className={`${input} mt-0 w-48`} disabled={!edit} value={h} onChange={(e) => setTool(i, { secretHeaders: t.secretHeaders.map((x, j) => (j === k ? e.target.value.replace(/[^A-Za-z0-9-]/g, '') : x)) })} placeholder="Authorization" />
                        <input type="password" autoComplete="off" className={`${input} mt-0 min-w-0 flex-1`} disabled={!edit || !d.encryption} value={t.secrets[h] ?? ''} onChange={(e) => setTool(i, { secrets: { ...t.secrets, [h]: e.target.value } })} placeholder={t.secretsSet.includes(h) ? 'Saved. Type to replace it.' : 'Value'} />
                        {edit && <button type="button" onClick={() => setTool(i, { secretHeaders: t.secretHeaders.filter((_, j) => j !== k) })} className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#dde2e8] text-[#5e6b7b] hover:text-[#b23a35]" aria-label={`Remove ${h || 'header'}`}><Trash2 className="h-4 w-4" /></button>}
                      </div>
                    ))}
                    {edit && t.secretHeaders.length < 5 && <button type="button" onClick={() => setTool(i, { secretHeaders: [...t.secretHeaders, ''] })} className="mt-2 text-[13.5px] font-medium text-[#0e1b2c] underline decoration-[#a8772a] underline-offset-2">Add a secret header</button>}
                  </div>
                  {edit && <div className="md:col-span-2"><button type="button" onClick={() => setF((x) => (x ? { ...x, http: x.http.filter((_, j) => j !== i) } : x))} className="text-[13.5px] font-medium text-[#b23a35]">Remove this tool</button></div>}
                </div>
              ))}
              {edit && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setF((x) => (x ? { ...x, http: [...x.http, blankTool()] } : x))} className="inline-flex h-11 items-center gap-1.5 rounded-full border border-[#dde2e8] bg-white px-5 text-sm font-medium text-[#0e1b2c] hover:border-[#a8772a]"><Plus className="h-4 w-4" />Add a web address the agent may call</button>
                  <button type="button" onClick={() => set('sp', [...f.sp, blankSp(d.sharePoint.knownTenant)])} className="inline-flex h-11 items-center gap-1.5 rounded-full border border-[#dde2e8] bg-white px-5 text-sm font-medium text-[#0e1b2c] hover:border-[#a8772a]"><Plus className="h-4 w-4" />Add a SharePoint library</button>
                  <button type="button" disabled={busy} onClick={save} className="inline-flex h-11 items-center rounded-full bg-[#0e1b2c] px-5 text-sm font-medium text-white hover:bg-[#22344a] disabled:opacity-40">{busy ? 'Saving…' : 'Save the tools'}</button>
                </div>
              )}
            </section>
          )}

          {tab === 'limits' && (
            <section className="grid gap-4 rounded-2xl border border-[#dde2e8] bg-white p-5 text-[14px] font-medium text-[#0e1b2c] md:grid-cols-2">
              <label className="block">Steps in one run<input type="number" className={input} disabled={!edit} min={LIMIT_RANGE.maxSteps[0]} max={LIMIT_RANGE.maxSteps[1]} value={f.limits.maxSteps} onChange={(e) => set('limits', { ...f.limits, maxSteps: e.target.value })} /><span className="mt-1 block text-[12.5px] font-normal text-[#5e6b7b]">Each time the model is asked counts as one.</span></label>
              <label className="block">Tokens in one run<input type="number" className={input} disabled={!edit} min={LIMIT_RANGE.maxTokensPerRun[0]} max={LIMIT_RANGE.maxTokensPerRun[1]} value={f.limits.maxTokensPerRun} onChange={(e) => set('limits', { ...f.limits, maxTokensPerRun: e.target.value })} /></label>
              <label className="block">Runs in 24 hours<input type="number" className={input} disabled={!edit} min={LIMIT_RANGE.maxRunsPerDay[0]} max={LIMIT_RANGE.maxRunsPerDay[1]} value={f.limits.maxRunsPerDay} onChange={(e) => set('limits', { ...f.limits, maxRunsPerDay: e.target.value })} /></label>
              <label className="block">Budget for the month, US dollars<input type="number" className={input} disabled={!edit} min={0} step="0.01" value={f.limits.monthlyBudgetUsd} onChange={(e) => set('limits', { ...f.limits, monthlyBudgetUsd: e.target.value })} placeholder="No budget" /><span className="mt-1 block text-[12.5px] font-normal text-[#5e6b7b]">Worked out from published model prices; new runs are refused once it is reached.</span></label>
              {edit && <div className="md:col-span-2"><button type="button" disabled={busy} onClick={save} className="inline-flex h-11 items-center rounded-full bg-[#0e1b2c] px-5 text-sm font-medium text-white hover:bg-[#22344a] disabled:opacity-40">{busy ? 'Saving…' : 'Save the limits'}</button></div>}
            </section>
          )}

          {tab === 'runs' && (
            runs.length === 0 ? <p className="text-[14px] text-[#5e6b7b]">No runs yet.</p> : (
              <ul className="divide-y divide-[#eef1f5] overflow-hidden rounded-2xl border border-[#dde2e8] bg-white">
                {runs.map((r) => (
                  <li key={r.id}>
                    <Link href={`/agents/${id}/runs/${r.id}`} className="flex flex-col gap-1 px-5 py-3.5 hover:bg-[#f5f7f9] sm:flex-row sm:items-center sm:gap-4">
                      <span className={`w-fit shrink-0 rounded-full px-2.5 py-0.5 text-[12.5px] font-medium ${RUN_STATUS[r.status]?.tone ?? ''}`}>{RUN_STATUS[r.status]?.label ?? r.status}</span>
                      <span className="min-w-0 flex-1 truncate text-[14px] text-[#0e1b2c]">{r.input}</span>
                      <span className="shrink-0 text-[13px] text-[#8a95a3]">{when(r.startedAt)}{r.trigger === 'api' ? ', from your systems' : ''}, ${Number(r.costUsd).toFixed(4)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )
          )}

          {tab === 'connect' && (
            <section className="space-y-3 rounded-2xl border border-[#dde2e8] bg-white p-5 text-[14px] text-[#2b3a4d]">
              <p>Start a run from your own systems with an AIC API key from <Link href="/settings/keys" className="font-medium text-[#0e1b2c] underline decoration-[#a8772a] underline-offset-2">API and access keys</Link>. AIC answers when the run finishes or stops to wait for a person; the run’s page shows every step either way.</p>
              <div className="relative">
                <pre className="overflow-x-auto rounded-xl bg-[#0e1b2c] p-3.5 pr-12 text-[12.5px] leading-relaxed text-white"><code>{snippet}</code></pre>
                <button type="button" onClick={() => navigator.clipboard?.writeText(snippet).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })} className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20" aria-label="Copy">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</button>
              </div>
              <p className="text-[13px] text-[#5e6b7b]">GET the same address for the list of runs. The agent must be switched on, and the limits on the Limits tab apply to these runs too.</p>
            </section>
          )}

          {edit && <p className="pt-4"><button type="button" disabled={busy} onClick={archive} className="text-[13.5px] text-[#5e6b7b] hover:text-[#b23a35]">Archive this agent</button><span className="ml-2 text-[13px] text-[#8a95a3]">Its runs and their records are kept; its keys are deleted.</span></p>}
        </div>
      )}
    </DashboardShell>
  );
}
