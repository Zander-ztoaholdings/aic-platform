'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, ShieldCheck, ShieldAlert } from 'lucide-react';
import DashboardShell from '../../../../components/DashboardShell';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { RUN_STATUS } from '../../../shared';

type Step = { id: string; seq: number; kind: string; name: string | null; detail: Record<string, unknown>; actorId: string | null; hash: string; createdAt: string };
type Pending = { kind: 'approval'; tool: string; method: string; url: string; body: unknown } | { kind: 'question'; tool: string; question: string };
type Run = {
  id: string; status: string; input: string; output: string | null; error: string | null; steps: number; inputTokens: number; outputTokens: number; costUsd: string;
  agentVersion: number; trigger: string; startedAt: string; finishedAt: string | null; pending: Pending | null;
};
type Data = { run: Run; steps: Step[]; chainIntact: boolean; canManage: boolean };

const time = (v: string) => new Date(v).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const LABEL: Record<string, string> = {
  started: 'Run started', model: 'The model answered', tool_call: 'Asked to use', tool_result: 'Result from', refused: 'Refused by AIC:',
  approval_requested: 'Waiting for approval:', approved: 'Approved by a person:', denied: 'Refused by a person:', question: 'Asked a person', answer: 'A person answered',
  decision_recorded: 'Decision recorded', finished: 'Run finished', failed: 'Run failed', stopped: 'Run stopped',
};
const tone = (k: string) => (['refused', 'denied', 'failed'].includes(k) ? 'bg-[#b23a35]' : ['approval_requested', 'question', 'stopped'].includes(k) ? 'bg-[#b45309]' : ['finished', 'approved', 'decision_recorded', 'answer'].includes(k) ? 'bg-[#2e7a57]' : 'bg-[#a8b2bf]');

function detailText(s: Step): string | null {
  const d = s.detail;
  if (s.kind === 'started') return String(d.input ?? '');
  if (s.kind === 'model') return [d.text ? String(d.text) : null, `${Number(d.inputTokens ?? 0).toLocaleString('en-GB')} tokens in, ${Number(d.outputTokens ?? 0).toLocaleString('en-GB')} out`].filter(Boolean).join('\n');
  if (s.kind === 'tool_call') return JSON.stringify(d.input);
  if (s.kind === 'tool_result') return d.status ? `HTTP ${d.status}` : 'No answer';
  if (s.kind === 'refused' || s.kind === 'failed' || s.kind === 'stopped') return String(d.reason ?? '');
  if (s.kind === 'approval_requested') return `${d.method} ${d.url}${d.body ? `\n${JSON.stringify(d.body)}` : ''}`;
  if (s.kind === 'denied') return d.reason ? String(d.reason) : null;
  if (s.kind === 'question') return String(d.question ?? '');
  if (s.kind === 'answer') return String(d.answer ?? '');
  if (s.kind === 'decision_recorded') return String(d.outcome ?? '');
  return null;
}

export default function RunPage({ params }: { params: Promise<{ id: string; runId: string }> }) {
  const { id, runId } = use(params);
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/agents/${id}/runs/${runId}`, { cache: 'no-store' }).then(async (r) => {
      const j = await r.json().catch(() => ({}));
      if (r.ok) setD(j); else setErr(j.error ?? 'Could not load the run.');
    });
  }, [id, runId]);
  useEffect(load, [load]);

  async function act(action: string) {
    setBusy(true); setErr('');
    const r = await fetch(`/api/agents/${id}/runs/${runId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, text }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) setErr(j.error ?? 'Could not do that.');
    setText('');
    load();
  }

  const run = d?.run;
  const open = run && ['running', 'waiting_for_person'].includes(run.status);
  return (
    <DashboardShell>
      <Link href={`/agents/${id}`} className="mb-3 inline-flex items-center gap-1.5 text-[14px] text-[#5e6b7b] hover:text-[#0e1b2c]"><ArrowLeft className="h-4 w-4" />Back to the agent</Link>
      <PageHeader
        eyebrow="Agent run"
        title={run ? <span className="inline-flex flex-wrap items-center gap-3">Run of {new Date(run.startedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, {time(run.startedAt)}<span className={`rounded-full px-2.5 py-0.5 font-sans text-[13px] font-medium ${RUN_STATUS[run.status]?.tone ?? ''}`}>{RUN_STATUS[run.status]?.label ?? run.status}</span></span> : 'Agent run'}
        actions={open && d?.canManage ? <button type="button" disabled={busy} onClick={() => act('stop')} className="inline-flex h-11 items-center rounded-full border border-[#dde2e8] bg-white px-5 text-sm font-medium text-[#0e1b2c] hover:border-[#b23a35]">Stop the run</button> : undefined}
      />
      {err && <p className="mb-4 text-[14px] text-[#b23a35]">{err}</p>}
      {!d && !err && <p className="text-sm text-[#5e6b7b]">Loading…</p>}
      {run && d && (
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <div className="space-y-5">
            {run.pending && d.canManage && (
              <section className="rounded-2xl border border-[#b45309]/35 bg-[#b45309]/[0.05] p-5">
                {run.pending.kind === 'approval' ? (
                  <>
                    <h2 className="text-[15px] font-semibold text-[#0e1b2c]">The agent wants to use {run.pending.tool}</h2>
                    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded-xl bg-white p-3 text-[13px] text-[#0e1b2c]">{run.pending.method} {run.pending.url}{run.pending.body ? `\n\n${JSON.stringify(run.pending.body, null, 2)}` : ''}</pre>
                    <input className="mt-3 h-11 w-full rounded-xl border border-[#dde2e8] bg-white px-3 text-[15px] outline-none focus:border-[#a8772a]" value={text} onChange={(e) => setText(e.target.value)} placeholder="Reason, if you refuse (the agent sees it)" />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" disabled={busy} onClick={() => act('approve')} className="inline-flex h-11 items-center rounded-full bg-[#0e1b2c] px-5 text-sm font-medium text-white hover:bg-[#22344a] disabled:opacity-40">Approve this call</button>
                      <button type="button" disabled={busy} onClick={() => act('deny')} className="inline-flex h-11 items-center rounded-full border border-[#dde2e8] bg-white px-5 text-sm font-medium text-[#0e1b2c] hover:border-[#b23a35]">Refuse it</button>
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="text-[15px] font-semibold text-[#0e1b2c]">The agent asks</h2>
                    <p className="mt-1 whitespace-pre-wrap text-[14.5px] text-[#2b3a4d]">{run.pending.question}</p>
                    <textarea className="mt-3 h-24 w-full rounded-xl border border-[#dde2e8] bg-white px-3 py-2 text-[15px] outline-none focus:border-[#a8772a]" value={text} onChange={(e) => setText(e.target.value)} placeholder="Your answer" />
                    <button type="button" disabled={busy || !text.trim()} onClick={() => act('answer')} className="mt-3 inline-flex h-11 items-center rounded-full bg-[#0e1b2c] px-5 text-sm font-medium text-white hover:bg-[#22344a] disabled:opacity-40">Send the answer</button>
                  </>
                )}
              </section>
            )}
            {run.output && (
              <section className="rounded-2xl border border-[#dde2e8] bg-white p-5">
                <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[#0e1b2c]"><CheckCircle2 className="h-4 w-4 text-[#2e7a57]" />What the agent concluded</h2>
                <p className="mt-2 whitespace-pre-wrap text-[14.5px] leading-relaxed text-[#2b3a4d]">{run.output}</p>
              </section>
            )}
            <section className="rounded-2xl border border-[#dde2e8] bg-white p-5">
              <h2 className="text-[15px] font-semibold text-[#0e1b2c]">Every step</h2>
              <ol className="mt-3 space-y-3">
                {d.steps.filter((s) => !(s.kind === 'tool_call' && (s.name === 'ask_a_person' || s.name === 'record_decision'))).map((s) => {
                  const t = detailText(s);
                  return (
                    <li key={s.id} className="flex gap-3">
                      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${tone(s.kind)}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] text-[#0e1b2c]"><span className="font-medium">{LABEL[s.kind] ?? s.kind}</span>{s.name && !['model', 'question', 'answer', 'decision_recorded'].includes(s.kind) ? ` ${s.name}` : ''}<span className="ml-2 text-[12.5px] text-[#8a95a3]">{time(s.createdAt)}</span></p>
                        {t && <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] text-[#5e6b7b]">{t.length > 1200 ? `${t.slice(0, 1200)}…` : t}</p>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          </div>
          <aside className="space-y-3 text-[13.5px] text-[#5e6b7b]">
            <div className="rounded-2xl border border-[#dde2e8] bg-white p-4">
              <p className="font-medium text-[#0e1b2c]">The task</p>
              <p className="mt-1 whitespace-pre-wrap">{run.input}</p>
            </div>
            <div className="rounded-2xl border border-[#dde2e8] bg-white p-4 space-y-1">
              <p>{run.steps} model {run.steps === 1 ? 'step' : 'steps'}</p>
              <p>{(Number(run.inputTokens) + Number(run.outputTokens)).toLocaleString('en-GB')} tokens</p>
              <p>${Number(run.costUsd).toFixed(4)} at published prices</p>
              <p>Agent version {run.agentVersion}, started {run.trigger === 'api' ? 'from your systems' : 'in AIC'}</p>
            </div>
            <p className={`flex items-start gap-2 rounded-2xl border p-4 ${d.chainIntact ? 'border-[#2e7a57]/25 text-[#1f5a40]' : 'border-[#b23a35]/30 text-[#8f2d29]'}`}>
              {d.chainIntact ? <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> : <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />}
              {d.chainIntact ? 'Every step is chained to the one before it, and the chain checks out.' : 'The step chain does not check out: a step was changed or removed after it was written.'}
            </p>
          </aside>
        </div>
      )}
    </DashboardShell>
  );
}
