'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, X, Search, Check, Library } from 'lucide-react';
import { Portal } from '@/app/components/ui/Portal';
import DashboardShell from '../components/DashboardShell';
import { PageHeader } from '@/app/components/ui/PageHeader';
import {
  LIKELIHOOD, IMPACT, CATEGORIES, CATEGORY_LABEL, TREATMENTS, TREATMENT_LABEL, STATUSES, STATUS_LABEL, LEVEL_LABEL,
  score, level, reviewMonths, type RiskLevel,
} from '@/lib/registers/risk';

type ScoreView = { likelihood: number; impact: number; score: number; level: RiskLevel };
type Signal = { id: string; kind: string; subject: string; title: string; evidence: string; href: string; libraryKeys: string[]; controls: string[] };
type Live = { trend: 'worse' | 'supported' | 'unverified'; failingControls: string[]; supportingControls: string[]; signals: Signal[]; sentence: string };
type Risk = {
  id: string; title: string; description: string | null; category: string; likelihood: number; impact: number;
  residualLikelihood: number | null; residualImpact: number | null; treatment: string; treatmentPlan: string | null;
  controls: string[]; ownerName: string | null; status: string; reviewAt: string | null; updatedAt: string; createdAt: string;
  source?: string; libraryKey?: string | null; signalKeys?: string[]; acceptedBy?: string | null; acceptReason?: string | null; acceptUntil?: string | null;
  inherent: ScoreView; target: ScoreView | null; current: ScoreView & { raisedBy: number };
  overdue: boolean; acceptanceExpired: boolean; live: Live;
};
type Template = { key: string; title: string; description: string; category: string; likelihood: number; impact: number; treatment: string; controls: string[]; signals: string[]; onRegister: boolean };
type Suggestion = { libraryKey: string; title: string; category: string; likelihood: number; impact: number; signals: Signal[] };
type Data = {
  risks: Risk[]; heatmaps: { inherent: number[][]; current: number[][] }; suggestions: Suggestion[]; dismissed: number; live: boolean;
  counts: { byStatus: Record<string, number>; byTreatment: Record<string, number>; overdue: number; unowned: number; worse: number; acceptanceExpired: number };
  library: Template[]; canManage: boolean; controls: { key: string; title: string; area: string }[];
};
type Event = { id: string; kind: string; detail: Record<string, unknown>; actor: string | null; createdAt: string };

const LEVEL_TONE: Record<RiskLevel, string> = {
  low: 'bg-[#2e7a57]/10 text-[#2e7a57]', medium: 'bg-[#a8772a]/12 text-[#8a6a1f]', high: 'bg-[#b45309]/12 text-[#b45309]', critical: 'bg-[#b23a35]/12 text-[#b23a35]',
};
const CELL_TONE: Record<RiskLevel, string> = {
  low: 'bg-[#2e7a57]/[0.07]', medium: 'bg-[#a8772a]/[0.10]', high: 'bg-[#b45309]/[0.14]', critical: 'bg-[#b23a35]/[0.16]',
};
const date = (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const when = (v: string) => new Date(v).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const chip = (on: boolean) => `inline-flex min-h-[36px] items-center rounded-full border px-3 text-[13px] font-medium transition-colors ${on ? 'border-[#0e1b2c] bg-[#0e1b2c] text-white' : 'border-[#dde2e8] bg-white text-[#0e1b2c] hover:border-[#a8772a]'}`;
const primary = 'inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-[#0e1b2c] px-5 text-sm font-medium text-white hover:bg-[#22344a] disabled:opacity-40';
const secondary = 'inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-[#dde2e8] bg-white px-5 text-sm font-medium text-[#0e1b2c] hover:border-[#a8772a] disabled:opacity-40';
const input = 'mt-1 h-11 w-full rounded-xl border border-[#dde2e8] px-3 text-[15px] font-normal outline-none focus:border-[#a8772a]';
const area = 'mt-1 w-full rounded-xl border border-[#dde2e8] px-3 py-2 text-[14px] font-normal outline-none focus:border-[#a8772a]';

async function send(url: string, method: string, body?: unknown): Promise<{ ok: boolean; error?: string; json: Record<string, unknown> }> {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, error: r.ok ? undefined : (j.error as string) ?? 'Something went wrong.', json: j };
}

function ScorePill({ v, label }: { v: ScoreView | null; label?: string }) {
  if (!v) return <span className="inline-flex h-7 min-w-[44px] items-center justify-center rounded-full border border-dashed border-[#c9ced6] px-2 text-[12px] text-[#8a95a3]">{label ? `${label} not set` : 'Not set'}</span>;
  return <span className={`inline-flex h-7 min-w-[44px] items-center justify-center rounded-full px-2 text-[12.5px] font-semibold tabular-nums ${LEVEL_TONE[v.level]}`} title={`${LEVEL_LABEL[v.level]}: likelihood ${v.likelihood}, impact ${v.impact}`}>{v.score}</span>;
}

function Drawer({ label, onClose, children, footer, wide }: { label: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex justify-center sm:items-start sm:px-6 sm:pt-[6vh] sm:pb-6" role="dialog" aria-modal="true" aria-label={label}>
        <div data-peek-backdrop className="absolute inset-0 bg-[#0a1728]/40 backdrop-blur-[1px]" onClick={onClose} />
        <div className={`relative flex h-full w-full ${wide ? 'sm:max-w-4xl' : 'sm:max-w-3xl'} flex-col overflow-hidden bg-white sm:h-auto sm:max-h-[88vh] sm:rounded-2xl sm:border sm:border-[#dde2e8] sm:shadow-[0_30px_90px_-24px_rgba(10,23,40,0.5)] aic-peek`}>
          <div className="flex items-center justify-between gap-3 border-b border-[#eef1f5] px-5 py-4">
            <h2 className="font-serif text-[20px] font-semibold text-[#0e1b2c]">{label}</h2>
            <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eef1f5]" aria-label="Close"><X className="h-4 w-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
          {footer && <div className="flex flex-wrap items-center gap-3 border-t border-[#eef1f5] px-5 py-4">{footer}</div>}
        </div>
      </div>
    </Portal>
  );
}

function Scale({ label, value, onChange, names, optional }: { label: string; value: number | null; onChange: (v: number | null) => void; names: string[]; optional?: boolean }) {
  return (
    <div>
      <p className="text-[13px] font-medium text-[#0e1b2c]">{label}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {names.map((n, i) => <button key={n} type="button" onClick={() => onChange(i + 1)} className={chip(value === i + 1)}>{i + 1} {n}</button>)}
        {optional && value !== null && <button type="button" onClick={() => onChange(null)} className="px-2 text-[13px] text-[#5e6b7b] hover:text-[#0e1b2c]">Clear</button>}
      </div>
    </div>
  );
}

// ── Add or edit a risk ───────────────────────────────────────────────────────

type Form = {
  title: string; description: string; category: string; likelihood: number; impact: number; residualLikelihood: number | null; residualImpact: number | null;
  treatment: string; treatmentPlan: string; controls: string[]; ownerName: string; status: string; reviewAt: string;
  acceptedBy: string; acceptReason: string; acceptUntil: string;
};
const blank = (): Form => ({ title: '', description: '', category: 'security', likelihood: 3, impact: 3, residualLikelihood: null, residualImpact: null, treatment: 'mitigate', treatmentPlan: '', controls: [], ownerName: '', status: 'open', reviewAt: '', acceptedBy: '', acceptReason: '', acceptUntil: '' });

function Editor({ risk, controls, live, onClose, onSaved }: { risk: Risk | null; controls: Data['controls']; live: boolean; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Form>(() => risk ? {
    title: risk.title, description: risk.description ?? '', category: risk.category, likelihood: risk.likelihood, impact: risk.impact,
    residualLikelihood: risk.residualLikelihood, residualImpact: risk.residualImpact, treatment: risk.treatment, treatmentPlan: risk.treatmentPlan ?? '',
    controls: risk.controls, ownerName: risk.ownerName ?? '', status: risk.status, reviewAt: risk.reviewAt ? risk.reviewAt.slice(0, 10) : '',
    acceptedBy: risk.acceptedBy ?? '', acceptReason: risk.acceptReason ?? '', acceptUntil: risk.acceptUntil ?? '',
  } : blank());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const s = score(f.likelihood, f.impact);
  const title = Object.fromEntries(controls.map((c) => [c.key, c.title]));
  const accepting = f.treatment === 'accept';

  async function save() {
    setBusy(true); setErr('');
    const r = await send(risk ? `/api/risks/${risk.id}` : '/api/risks', risk ? 'PATCH' : 'POST', f);
    setBusy(false);
    if (!r.ok) { setErr(r.error ?? 'Could not save.'); return; }
    onSaved();
  }

  return (
    <Drawer label={risk ? 'Edit risk' : 'Add a risk'} onClose={onClose} footer={<>
      <button type="button" onClick={save} disabled={busy || f.title.trim().length < 3} className={primary}>{busy ? 'Saving…' : risk ? 'Save changes' : 'Add risk'}</button>
      <button type="button" onClick={onClose} className="h-11 px-3 text-sm font-medium text-[#5e6b7b] hover:text-[#0e1b2c]">Cancel</button>
      {err && <span className="text-[13px] text-[#b23a35]">{err}</span>}
    </>}>
      <div className="space-y-5">
        <label className="block text-[13px] font-medium text-[#0e1b2c]">What could go wrong
          <input value={f.title} onChange={(e) => set('title', e.target.value)} maxLength={200} placeholder="e.g. Loan model declines a protected group more often" className={input} />
        </label>
        <label className="block text-[13px] font-medium text-[#0e1b2c]">More detail <span className="font-normal text-[#5e6b7b]">(optional)</span>
          <textarea value={f.description} onChange={(e) => set('description', e.target.value)} rows={3} className={area} />
        </label>
        <div>
          <p className="text-[13px] font-medium text-[#0e1b2c]">Kind of risk</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">{CATEGORIES.map((c) => <button key={c} type="button" onClick={() => set('category', c)} className={chip(f.category === c)}>{CATEGORY_LABEL[c]}</button>)}</div>
        </div>
        <Scale label="How likely is it, before any treatment?" value={f.likelihood} onChange={(v) => set('likelihood', v ?? 3)} names={LIKELIHOOD} />
        <Scale label="How bad would it be?" value={f.impact} onChange={(v) => set('impact', v ?? 3)} names={IMPACT} />
        <p className="text-[13px] text-[#5e6b7b]">Inherent score {s}: <span className={`rounded-full px-2 py-0.5 text-[12px] font-medium ${LEVEL_TONE[level(s)]}`}>{LEVEL_LABEL[level(s)]}</span></p>
        <div>
          <p className="text-[13px] font-medium text-[#0e1b2c]">What you will do about it</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">{TREATMENTS.map((t) => <button key={t} type="button" onClick={() => set('treatment', t)} className={chip(f.treatment === t)}>{TREATMENT_LABEL[t]}</button>)}</div>
          <textarea value={f.treatmentPlan} onChange={(e) => set('treatmentPlan', e.target.value)} rows={2} placeholder="The plan, in a sentence or two" className={area + ' mt-2'} />
        </div>
        {accepting && (
          <div className="space-y-3 rounded-xl border border-[#a8772a]/40 bg-[#a8772a]/[0.05] p-4">
            <p className="text-[13px] text-[#0e1b2c]">Accepting a risk is a decision someone with authority makes, for a reason, for a limited time.{!live && ' This AIC server cannot record acceptances yet (database migration 018).'}</p>
            <label className="block text-[13px] font-medium text-[#0e1b2c]">Approved by
              <input value={f.acceptedBy} onChange={(e) => set('acceptedBy', e.target.value)} placeholder="The person who approved it" className={input} />
            </label>
            <label className="block text-[13px] font-medium text-[#0e1b2c]">Why it is acceptable
              <textarea value={f.acceptReason} onChange={(e) => set('acceptReason', e.target.value)} rows={2} className={area} />
            </label>
            <label className="block text-[13px] font-medium text-[#0e1b2c]">Accepted until
              <input type="date" value={f.acceptUntil} onChange={(e) => set('acceptUntil', e.target.value)} className={input} />
            </label>
          </div>
        )}
        <div>
          <p className="text-[13px] font-medium text-[#0e1b2c]">Controls that reduce it</p>
          <p className="text-[12.5px] text-[#5e6b7b]">AIC watches these. If one starts failing, the risk shows as getting worse.</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {f.controls.map((k) => (
              <span key={k} className="inline-flex items-center gap-1 rounded-full bg-[#a8772a]/10 py-1 pl-2.5 pr-1 text-[12px] font-medium text-[#6f5418]">{title[k] ?? k}
                <button type="button" onClick={() => set('controls', f.controls.filter((x) => x !== k))} className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-[#a8772a]/20" aria-label={`Remove ${title[k]}`}><X className="h-3 w-3" /></button>
              </span>
            ))}
            <select value="" onChange={(e) => e.target.value && set('controls', [...f.controls, e.target.value])} aria-label="Add a control" className="h-8 max-w-full rounded-full border border-dashed border-[#c9ced6] bg-white px-2 text-[12px] text-[#5e6b7b] outline-none">
              <option value="">Add a control</option>
              {controls.filter((c) => !f.controls.includes(c.key)).map((c) => <option key={c.key} value={c.key}>{c.title}</option>)}
            </select>
          </div>
        </div>
        <Scale label="Target likelihood once treated (optional)" value={f.residualLikelihood} onChange={(v) => set('residualLikelihood', v)} names={LIKELIHOOD} optional />
        <Scale label="Target impact once treated (optional)" value={f.residualImpact} onChange={(v) => set('residualImpact', v)} names={IMPACT} optional />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-[13px] font-medium text-[#0e1b2c]">Owner
            <input value={f.ownerName} onChange={(e) => set('ownerName', e.target.value)} placeholder="A named person" className={input} />
          </label>
          <label className="block text-[13px] font-medium text-[#0e1b2c]">Review by
            <input type="date" value={f.reviewAt} onChange={(e) => set('reviewAt', e.target.value)} className={input} />
            <span className="mt-1 block text-[12px] font-normal text-[#5e6b7b]">Leave empty and AIC sets it from the score: every {reviewMonths(s)} months.</span>
          </label>
        </div>
        <div>
          <p className="text-[13px] font-medium text-[#0e1b2c]">Status</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">{STATUSES.map((t) => <button key={t} type="button" onClick={() => set('status', t)} className={chip(f.status === t)}>{STATUS_LABEL[t]}</button>)}</div>
        </div>
      </div>
    </Drawer>
  );
}

// ── The risk drawer: scores, evidence, treatment, history ────────────────────

const EVENT_LABEL: Record<string, string> = { created: 'Added to the register', scored: 'Score changed', treatment: 'Treatment changed', reviewed: 'Reviewed', signal: 'Evidence changed', closed: 'Closed', reopened: 'Reopened' };

function eventText(e: Event): string {
  const d = e.detail ?? {};
  const n = (x: unknown) => (typeof x === 'number' ? x : null);
  if (e.kind === 'created') return d.source === 'signal' ? 'Added from something AIC noticed.' : d.source === 'library' ? "Added from AIC's risk library." : n(d.score) !== null ? `Inherent score ${d.score}.` : '';
  if (e.kind === 'scored') {
    const from = d.from as { score?: number } | undefined, to = d.to as { score?: number } | undefined;
    return from?.score !== undefined && to?.score !== undefined ? `Inherent score ${from.score} to ${to.score}.` : '';
  }
  if (e.kind === 'treatment') {
    const t = `${TREATMENT_LABEL[String(d.from)] ?? d.from} to ${(TREATMENT_LABEL[String(d.to)] ?? String(d.to)).toLowerCase()}.`;
    return d.to === 'accept' && d.acceptedBy ? `${t} Approved by ${d.acceptedBy} until ${date(String(d.acceptUntil))}: ${d.acceptReason}` : t;
  }
  if (e.kind === 'reviewed') return `Next review ${date(String(d.next))}${d.note ? `. ${d.note}` : '.'}`;
  if (e.kind === 'signal') {
    if (Array.isArray(d.signals)) return (d.signals as { evidence?: string }[]).map((s) => s.evidence).filter(Boolean).join(' ');
    return n(d.from) !== null && n(d.to) !== null ? `Current score ${d.from} to ${d.to}. ${d.why ?? ''}`.trim() : '';
  }
  return '';
}

function RiskDrawer({ risk, data, onClose, onEdit, onChanged }: { risk: Risk; data: Data; onClose: () => void; onEdit: () => void; onChanged: () => void }) {
  const [events, setEvents] = useState<Event[] | null>(null);
  const [eventsLive, setEventsLive] = useState(true);
  const [note, setNote] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const ctl = Object.fromEntries(data.controls.map((c) => [c.key, c.title]));

  const loadEvents = useCallback(() => {
    fetch(`/api/risks/${risk.id}`, { cache: 'no-store' }).then((r) => r.json()).then((j) => { setEvents(j.events ?? []); setEventsLive(j.live !== false); }).catch(() => setEvents([]));
  }, [risk.id]);
  useEffect(loadEvents, [loadEvents]);

  async function markReviewed() {
    setBusy(true); setErr('');
    const r = await send(`/api/risks/${risk.id}/review`, 'POST', { note });
    setBusy(false);
    if (!r.ok) { setErr(r.error ?? 'Could not record the review.'); return; }
    setReviewing(false); setNote(''); loadEvents(); onChanged();
  }

  const trendTone = risk.live.trend === 'worse' ? 'border-[#b23a35]/30 bg-[#b23a35]/[0.05] text-[#b23a35]' : risk.live.trend === 'supported' ? 'border-[#2e7a57]/30 bg-[#2e7a57]/[0.05] text-[#2e7a57]' : 'border-[#dde2e8] bg-[#f5f7f9] text-[#5e6b7b]';

  return (
    <Drawer label="Risk" onClose={onClose} wide footer={data.canManage ? <>
      {risk.status !== 'closed' && !reviewing && <button type="button" onClick={() => setReviewing(true)} className={primary}><Check className="h-4 w-4" />Mark reviewed</button>}
      {reviewing && <button type="button" onClick={markReviewed} disabled={busy} className={primary}>{busy ? 'Saving…' : 'Record the review'}</button>}
      <button type="button" onClick={onEdit} className={secondary}>Edit risk</button>
      {err && <span className="text-[13px] text-[#b23a35]">{err}</span>}
    </> : undefined}>
      <div className="space-y-6">
        <div>
          <p className="text-[13px] text-[#5e6b7b]">{CATEGORY_LABEL[risk.category] ?? risk.category}, {STATUS_LABEL[risk.status]?.toLowerCase()}{risk.source === 'signal' ? ', raised by AIC' : risk.source === 'library' ? ", from AIC's library" : ''}</p>
          <h3 className="mt-1 text-[18px] font-semibold leading-snug text-[#0e1b2c]">{risk.title}</h3>
          {risk.description && <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-[#5e6b7b]">{risk.description}</p>}
        </div>

        <section>
          <div className="grid grid-cols-3 gap-2">
            {[{ label: 'Inherent', v: risk.inherent, sub: 'before treatment' }, { label: 'Current', v: risk.current, sub: 'from the evidence' }, { label: 'Target', v: risk.target, sub: 'once treated' }].map((x) => (
              <div key={x.label} className="rounded-xl border border-[#dde2e8] p-3">
                <p className="text-[12.5px] font-medium text-[#0e1b2c]">{x.label}</p>
                <div className="mt-1.5"><ScorePill v={x.v} /></div>
                <p className="mt-1.5 text-[12px] text-[#5e6b7b]">{x.v ? `${LEVEL_LABEL[x.v.level]}, ${x.sub}` : `Not recorded`}</p>
              </div>
            ))}
          </div>
          {risk.current.raisedBy > 0 && <p className="mt-2 text-[12.5px] text-[#5e6b7b]">Current likelihood is {risk.current.raisedBy} higher than recorded because of the failing evidence below. What you recorded is unchanged.</p>}
          <div className={`mt-3 rounded-xl border px-4 py-3 text-[13.5px] ${trendTone}`}>
            <p>{risk.live.sentence}</p>
            {risk.live.failingControls.length > 0 && (
              <ul className="mt-2 space-y-1 text-[13px] text-[#0e1b2c]">
                {risk.live.failingControls.map((k) => <li key={k}><Link href={`/controls?view=common#${k}`} className="font-medium underline decoration-[#b23a35]/40 underline-offset-2">{ctl[k] ?? k}</Link> has a gap</li>)}
              </ul>
            )}
            {risk.live.signals.length > 0 && (
              <ul className="mt-2 space-y-1.5 text-[13px] text-[#0e1b2c]">
                {risk.live.signals.map((s) => <li key={s.id}>{s.evidence} <Link href={s.href} className="font-medium text-[#8a6a1f] hover:underline">See the evidence</Link></li>)}
              </ul>
            )}
          </div>
        </section>

        <section className="space-y-2 text-[14px] text-[#0e1b2c]">
          <h4 className="text-[15px] font-semibold">Treatment</h4>
          <p>{TREATMENT_LABEL[risk.treatment]}{risk.treatmentPlan ? `: ${risk.treatmentPlan}` : '.'}</p>
          {risk.treatment === 'accept' && (risk.acceptedBy
            ? <p className={risk.acceptanceExpired ? 'text-[#b23a35]' : 'text-[#5e6b7b]'}>Accepted by {risk.acceptedBy} until {date(risk.acceptUntil)}{risk.acceptanceExpired ? ', which has passed: decide again' : ''}. {risk.acceptReason}</p>
            : <p className="text-[#b45309]">No approver, reason or expiry recorded for this acceptance.</p>)}
          {risk.controls.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {risk.controls.map((k) => {
                const failing = risk.live.failingControls.includes(k), ok = risk.live.supportingControls.includes(k);
                return <span key={k} className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${failing ? 'bg-[#b23a35]/10 text-[#b23a35]' : ok ? 'bg-[#2e7a57]/10 text-[#2e7a57]' : 'bg-[#eef1f5] text-[#5e6b7b]'}`}>{ctl[k] ?? k}{failing ? ', failing' : ok ? ', evidenced' : ''}</span>;
              })}
            </div>
          )}
          <p className="pt-1 text-[13px] text-[#5e6b7b]">
            <span className={risk.ownerName ? '' : 'text-[#b23a35]'}>{risk.ownerName ? `Owned by ${risk.ownerName}` : 'No owner'}</span>
            {risk.reviewAt && <>. <span className={risk.overdue ? 'font-medium text-[#b23a35]' : ''}>{risk.overdue ? 'Review was due' : 'Next review'} {date(risk.reviewAt)}</span></>}
            . Reviewed every {reviewMonths(risk.current.score)} months at this score.
          </p>
          {reviewing && (
            <label className="block text-[13px] font-medium text-[#0e1b2c]">What you checked <span className="font-normal text-[#5e6b7b]">(optional)</span>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} autoFocus className={area} placeholder="e.g. Bias test re-run, no change" />
            </label>
          )}
        </section>

        <section>
          <h4 className="text-[15px] font-semibold text-[#0e1b2c]">History</h4>
          {!eventsLive && <p className="mt-1 text-[13px] text-[#5e6b7b]">This AIC server does not keep risk history yet (database migration 018).</p>}
          {eventsLive && events === null && <p className="mt-1 text-[13px] text-[#5e6b7b]">Loading…</p>}
          {eventsLive && events?.length === 0 && <p className="mt-1 text-[13px] text-[#5e6b7b]">Nothing recorded yet. Added {date(risk.createdAt)}.</p>}
          {events && events.length > 0 && (
            <ol className="mt-3 space-y-3 border-l border-[#dde2e8] pl-4">
              {events.map((e) => (
                <li key={e.id} className="relative">
                  <span className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ${e.kind === 'signal' ? 'bg-[#b45309]' : e.kind === 'closed' ? 'bg-[#5e6b7b]' : 'bg-[#a8772a]'}`} />
                  <p className="text-[13.5px] font-medium text-[#0e1b2c]">{EVENT_LABEL[e.kind] ?? e.kind}</p>
                  {eventText(e) && <p className="text-[13px] text-[#5e6b7b]">{eventText(e)}</p>}
                  <p className="text-[12px] text-[#5e6b7b]">{when(e.createdAt)}{e.actor ? `, ${e.actor}` : e.kind === 'signal' ? ', AIC' : ''}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </Drawer>
  );
}

// ── The library ──────────────────────────────────────────────────────────────

function LibraryDrawer({ library, onClose, onAdded }: { library: Template[]; onClose: () => void; onAdded: (n: number) => void }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const shown = library.filter((t) => (!cat || t.category === cat) && (!q.trim() || `${t.title} ${t.description}`.toLowerCase().includes(q.trim().toLowerCase())));
  const toggle = (k: string) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  async function add() {
    setBusy(true); setErr('');
    const r = await send('/api/risks/library', 'POST', { keys: picked });
    setBusy(false);
    if (!r.ok) { setErr(r.error ?? 'Could not add the risks.'); return; }
    onAdded(Number(r.json.added ?? 0));
  }

  return (
    <Drawer label="Add from the risk library" onClose={onClose} wide footer={<>
      <button type="button" onClick={add} disabled={busy || picked.length === 0} className={primary}>{busy ? 'Adding…' : picked.length ? `Add ${picked.length} risk${picked.length === 1 ? '' : 's'}` : 'Choose risks to add'}</button>
      {picked.length > 0 && <button type="button" onClick={() => setPicked([])} className="h-11 px-3 text-sm font-medium text-[#5e6b7b] hover:text-[#0e1b2c]">Clear choice</button>}
      {err && <span className="text-[13px] text-[#b23a35]">{err}</span>}
    </>}>
      <p className="text-[14px] text-[#5e6b7b]">Risks most organisations that use AI to make decisions about people should consider, and the security risks every register needs. Each comes with a suggested score, treatment and controls; change them to fit once added.</p>
      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5e6b7b]" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the library" aria-label="Search the library" className="h-11 w-full rounded-xl border border-[#dde2e8] pl-9 pr-3 text-[15px] outline-none focus:border-[#a8772a]" />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setCat(null)} className={chip(cat === null)}>All</button>
        {CATEGORIES.map((c) => <button key={c} type="button" onClick={() => setCat(cat === c ? null : c)} className={chip(cat === c)}>{CATEGORY_LABEL[c]}</button>)}
      </div>
      <ul className="mt-4 space-y-2">
        {shown.map((t) => {
          const on = picked.includes(t.key);
          const s = score(t.likelihood, t.impact);
          return (
            <li key={t.key}>
              <button type="button" disabled={t.onRegister} onClick={() => toggle(t.key)} aria-pressed={on}
                className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${on ? 'border-[#0e1b2c] bg-[#f5f7f9]' : 'border-[#dde2e8] bg-white hover:border-[#a8772a]/60'} disabled:cursor-default disabled:opacity-60`}>
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${on ? 'border-[#0e1b2c] bg-[#0e1b2c] text-white' : 'border-[#c9ced6]'}`}>{(on || t.onRegister) && <Check className="h-3.5 w-3.5" />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-medium text-[#0e1b2c]">{t.title}</span>
                  <span className="mt-0.5 block text-[13px] leading-relaxed text-[#5e6b7b]">{t.description}</span>
                  <span className="mt-1 block text-[12.5px] text-[#5e6b7b]">{CATEGORY_LABEL[t.category]}, suggested score {s} ({LEVEL_LABEL[level(s)].toLowerCase()}){t.signals.length ? ', AIC watches for it' : ''}{t.onRegister ? ', already on your register' : ''}</span>
                </span>
              </button>
            </li>
          );
        })}
        {shown.length === 0 && <li className="rounded-xl border border-[#dde2e8] px-4 py-5 text-[14px] text-[#5e6b7b]">Nothing in the library matches.</li>}
      </ul>
    </Drawer>
  );
}

// ── AIC noticed ──────────────────────────────────────────────────────────────

function Noticed({ items, canManage, live, onChanged }: { items: Suggestion[]; canManage: boolean; live: boolean; onChanged: (msg: string, id?: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<{ key: string; text: string } | null>(null);

  async function act(s: Suggestion, action: 'add' | 'dismiss') {
    setBusy(s.libraryKey); setErr(null);
    const r = await send('/api/risks/suggestions', 'POST', { action, libraryKey: s.libraryKey, signals: s.signals.map((x) => x.id), reason });
    setBusy(null);
    if (!r.ok) { setErr({ key: s.libraryKey, text: r.error ?? 'Could not do that.' }); return; }
    setDismissing(null); setReason('');
    onChanged(action === 'add' ? `Added "${s.title}" to the register.` : 'Dismissed. AIC will not suggest it again unless it sees something new.', r.json.id as string | undefined);
  }

  if (!items.length) return null;
  return (
    <section className="mb-6 rounded-2xl border border-[#a8772a]/40 bg-white p-5">
      <h2 className="text-[16px] font-semibold text-[#0e1b2c]">AIC noticed</h2>
      <p className="mt-0.5 max-w-2xl text-[13.5px] text-[#5e6b7b]">From what AIC already sees in your connected systems, decisions, suppliers and spend, {items.length === 1 ? 'one risk is' : `${items.length} risks are`} not on your register yet.</p>
      <ul className="mt-4 divide-y divide-[#eef1f5]">
        {items.map((s) => {
          const sc = score(s.likelihood, s.impact);
          return (
            <li key={s.libraryKey} className="py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-start gap-3">
                <span className={`mt-0.5 inline-flex h-7 min-w-[44px] items-center justify-center rounded-full px-2 text-[12.5px] font-semibold tabular-nums ${LEVEL_TONE[level(sc)]}`} title="Suggested inherent score">{sc}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium text-[#0e1b2c]">{s.title}</p>
                  <ul className="mt-1.5 space-y-1 text-[13px] text-[#5e6b7b]">
                    {s.signals.map((x) => <li key={x.id}>{x.evidence} <Link href={x.href} className="font-medium text-[#8a6a1f] hover:underline">See the evidence</Link></li>)}
                  </ul>
                  {canManage && dismissing !== s.libraryKey && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={() => act(s, 'add')} disabled={busy === s.libraryKey} className="inline-flex h-10 items-center rounded-full bg-[#0e1b2c] px-4 text-[13.5px] font-medium text-white hover:bg-[#22344a] disabled:opacity-40">{busy === s.libraryKey ? 'Adding…' : 'Add to the register'}</button>
                      {live && <button type="button" onClick={() => { setDismissing(s.libraryKey); setReason(''); }} className="inline-flex h-10 items-center rounded-full border border-[#dde2e8] px-4 text-[13.5px] font-medium text-[#0e1b2c] hover:border-[#a8772a]">Dismiss</button>}
                    </div>
                  )}
                  {dismissing === s.libraryKey && (
                    <div className="mt-3 space-y-2">
                      <label className="block text-[13px] font-medium text-[#0e1b2c]">Why does this not belong on the register?
                        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} autoFocus className={area} placeholder="e.g. Covered by the supplier risk we already hold" />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => act(s, 'dismiss')} disabled={busy === s.libraryKey || reason.trim().length < 5} className="inline-flex h-10 items-center rounded-full bg-[#0e1b2c] px-4 text-[13.5px] font-medium text-white hover:bg-[#22344a] disabled:opacity-40">Dismiss with this reason</button>
                        <button type="button" onClick={() => setDismissing(null)} className="h-10 px-3 text-[13.5px] font-medium text-[#5e6b7b] hover:text-[#0e1b2c]">Keep it</button>
                      </div>
                    </div>
                  )}
                  {err?.key === s.libraryKey && <p className="mt-2 text-[13px] text-[#b23a35]">{err.text}</p>}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ── The page ─────────────────────────────────────────────────────────────────

type Quick = 'worse' | 'unowned' | 'overdue' | null;

export default function RisksPage() {
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cell, setCell] = useState<[number, number] | null>(null);
  const [view, setView] = useState<'current' | 'inherent'>('current');
  const [quick, setQuick] = useState<Quick>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [editing, setEditing] = useState<Risk | 'new' | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [library, setLibrary] = useState(false);

  const load = useCallback(() => {
    fetch('/api/risks', { cache: 'no-store' }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setD(j); }).catch((e) => setError(e.message || 'Could not load the risk register.'));
  }, []);
  useEffect(load, [load]);

  const pos = useCallback((r: Risk) => (view === 'current' ? r.current : r.inherent), [view]);
  const shown = useMemo(() => (d?.risks ?? []).filter((r) => (showClosed || r.status !== 'closed')
    && (!cell || (pos(r).likelihood === cell[0] && pos(r).impact === cell[1]))
    && (quick !== 'worse' || r.live.trend === 'worse') && (quick !== 'unowned' || !r.ownerName) && (quick !== 'overdue' || r.overdue)), [d, cell, showClosed, quick, pos]);
  const open = (d?.risks ?? []).filter((r) => r.status !== 'closed');
  const grid = d ? d.heatmaps[view] : [];
  const opened = d?.risks.find((r) => r.id === openId) ?? null;
  const critical = open.filter((r) => r.current.level === 'critical').length;
  const high = open.filter((r) => r.current.level === 'high').length;

  const filterLabel = [
    cell ? `${LIKELIHOOD[cell[0] - 1].toLowerCase()}, ${IMPACT[cell[1] - 1].toLowerCase()} (${view})` : '',
    quick === 'worse' ? 'getting worse' : quick === 'unowned' ? 'without an owner' : quick === 'overdue' ? 'review overdue' : '',
  ].filter(Boolean).join(', ');

  return (
    <DashboardShell>
      <PageHeader
        eyebrow="Risk and people"
        title="Risk register"
        lede="What could go wrong, how likely it is, how bad it would be, and what you are doing about it. AIC keeps it current from what it already sees: failing checks, undeclared systems, suppliers, leavers and spend."
        actions={d?.canManage ? <>
          <button type="button" onClick={() => setLibrary(true)} className={secondary}><Library className="h-4 w-4" />Add from library</button>
          <button type="button" onClick={() => setEditing('new')} className={primary}><Plus className="h-4 w-4" />Add a risk</button>
        </> : undefined}
      />
      {error && <p className="text-sm text-[#b23a35]">{error}</p>}
      {!d && !error && <p className="text-sm text-[#5e6b7b]">Loading…</p>}
      {notice && <p role="status" className="mb-4 rounded-xl border border-[#2e7a57]/30 bg-[#2e7a57]/[0.06] px-4 py-2.5 text-[13.5px] text-[#2e7a57]">{notice}</p>}
      {d && !d.live && <p className="mb-4 text-[13px] text-[#5e6b7b]">Risk history, dismissed suggestions and acceptances switch on once this AIC server has database migration 018. Everything else works now.</p>}

      {d && <Noticed items={d.suggestions} canManage={d.canManage} live={d.live} onChanged={(msg, id) => { setNotice(msg); load(); if (id) setOpenId(id); }} />}

      {d && d.risks.length === 0 && (
        <div className="rounded-2xl border border-[#dde2e8] bg-white p-6">
          <p className="text-[15px] font-medium text-[#0e1b2c]">No risks recorded yet.</p>
          <p className="mt-1 max-w-2xl text-[14px] text-[#5e6b7b]">Start with the three or four things that would hurt most: a model treating a group unfairly, customer data leaking, a key supplier failing. The library has these written out, ready to adjust. ISO 27001, ISO 42001 and the NIST frameworks all expect a register like this.</p>
          {d.canManage && <button type="button" onClick={() => setLibrary(true)} className={secondary + ' mt-4'}><Library className="h-4 w-4" />Add from library</button>}
        </div>
      )}

      {d && d.risks.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <section className="rounded-2xl border border-[#dde2e8] bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[15px] font-semibold text-[#0e1b2c]">Open risks by likelihood and impact</h2>
                <div className="inline-flex rounded-full border border-[#dde2e8] p-0.5" role="group" aria-label="Which score to plot">
                  {(['current', 'inherent'] as const).map((v) => (
                    <button key={v} type="button" onClick={() => { setView(v); setCell(null); }} aria-pressed={view === v} className={`h-8 rounded-full px-3 text-[12.5px] font-medium ${view === v ? 'bg-[#0e1b2c] text-white' : 'text-[#5e6b7b] hover:text-[#0e1b2c]'}`}>{v === 'current' ? 'Current' : 'Inherent'}</button>
                  ))}
                </div>
              </div>
              <p className="mt-1 text-[12.5px] text-[#5e6b7b]">{view === 'current' ? 'Where each risk sits now, from the evidence.' : 'Before any treatment, as recorded.'} Tap a square to see only those risks.</p>
              <div className="mt-4 grid max-w-[360px] grid-cols-[18px_repeat(5,minmax(0,1fr))] gap-1">
                {[5, 4, 3, 2, 1].map((L) => (
                  <div key={L} className="contents">
                    <span className="flex items-center justify-center text-[11px] text-[#5e6b7b]">{L}</span>
                    {[1, 2, 3, 4, 5].map((I) => {
                      const n = grid[L - 1]?.[I - 1] ?? 0;
                      const on = cell?.[0] === L && cell?.[1] === I;
                      return (
                        <button key={I} type="button" disabled={n === 0} onClick={() => setCell(on ? null : [L, I])}
                          title={`${LIKELIHOOD[L - 1]}, ${IMPACT[I - 1].toLowerCase()}: ${n} risk${n === 1 ? '' : 's'}`}
                          className={`flex aspect-square items-center justify-center rounded-lg text-[13px] font-semibold tabular-nums ${CELL_TONE[level(L * I)]} ${on ? 'ring-2 ring-[#0e1b2c]' : ''} ${n ? 'text-[#0e1b2c] hover:ring-1 hover:ring-[#0e1b2c]/30' : 'text-transparent'}`}>{n || '0'}</button>
                      );
                    })}
                  </div>
                ))}
                <span />
                {[1, 2, 3, 4, 5].map((I) => <span key={I} className="text-center text-[11px] text-[#5e6b7b]">{I}</span>)}
              </div>
              <div className="mt-2 flex max-w-[360px] justify-between text-[11.5px] text-[#5e6b7b]"><span>Likelihood up</span><span>Impact across</span></div>
            </section>

            <section className="rounded-2xl border border-[#dde2e8] bg-white p-5 text-[14px] text-[#0e1b2c]">
              <p><span className="font-semibold">{open.length}</span> open{critical ? <>, <span className="text-[#b23a35]">{critical} critical</span></> : null}{high ? <>, <span className="text-[#b45309]">{high} high</span></> : null} now.</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {([['worse', d.counts.worse, 'Getting worse'], ['unowned', d.counts.unowned, 'Without an owner'], ['overdue', d.counts.overdue, 'Review overdue']] as const).map(([k, n, label]) => (
                  <button key={k} type="button" disabled={n === 0} onClick={() => setQuick(quick === k ? null : k)} aria-pressed={quick === k}
                    className={`${chip(quick === k)} disabled:cursor-default disabled:opacity-50`}>{label} <span className={`ml-1.5 tabular-nums ${quick === k ? 'text-white' : n ? 'text-[#b23a35]' : 'text-[#5e6b7b]'}`}>{n}</span></button>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
                <p className="col-span-2 font-medium text-[#0e1b2c]">By status</p>
                {STATUSES.map((s) => <div key={s} className="contents"><span className="text-[#5e6b7b]">{STATUS_LABEL[s]}</span><span className="text-right tabular-nums">{d.counts.byStatus[s] ?? 0}</span></div>)}
                <p className="col-span-2 mt-2 font-medium text-[#0e1b2c]">Open, by treatment</p>
                {TREATMENTS.map((t) => <div key={t} className="contents"><span className="text-[#5e6b7b]">{TREATMENT_LABEL[t]}</span><span className="text-right tabular-nums">{d.counts.byTreatment[t] ?? 0}</span></div>)}
              </div>
              {d.counts.acceptanceExpired > 0 && <p className="mt-3 text-[13px] text-[#b23a35]">{d.counts.acceptanceExpired} accepted risk{d.counts.acceptanceExpired === 1 ? ' has' : 's have'} passed the date the acceptance ran until.</p>}
              <p className="mt-3 text-[12.5px] text-[#5e6b7b]">Score is likelihood × impact: 1 to 4 low, 5 to 9 medium, 10 to 16 high, 20 and above critical. Current adds one to likelihood for each piece of failing evidence, at most two. High and critical risks are reviewed every 3 months, medium every 6, low every 12.</p>
            </section>
          </aside>

          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] text-[#5e6b7b]">{filterLabel ? <>Showing {filterLabel}. <button type="button" onClick={() => { setCell(null); setQuick(null); }} className="font-medium text-[#8a6a1f] hover:underline">Show all</button></> : 'Highest current score first.'}</p>
              <label className="flex items-center gap-2 text-[13px] text-[#5e6b7b]"><input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} className="h-4 w-4 accent-[#0e1b2c]" />Show closed</label>
            </div>
            <ul className="space-y-2">
              {shown.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => setOpenId(r.id)} className={`w-full rounded-xl border bg-white px-4 py-3.5 text-left hover:border-[#a8772a]/60 ${r.live.trend === 'worse' ? 'border-[#b23a35]/35' : 'border-[#dde2e8]'} ${r.status === 'closed' ? 'opacity-60' : ''}`}>
                    <div className="flex flex-wrap items-start gap-3">
                      <span className="flex shrink-0 flex-col items-center gap-0.5">
                        <ScorePill v={r.current} />
                        <span className="text-[11px] text-[#5e6b7b]">now</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-medium text-[#0e1b2c]">{r.title}</span>
                        <span className="mt-0.5 block text-[13px] text-[#5e6b7b]">
                          {CATEGORY_LABEL[r.category] ?? r.category}, {TREATMENT_LABEL[r.treatment]?.toLowerCase()}, {STATUS_LABEL[r.status]?.toLowerCase()}. Inherent {r.inherent.score}{r.target ? `, target ${r.target.score}` : ''}.
                        </span>
                        {r.status !== 'closed' && r.live.trend === 'worse' && <span className="mt-1 block text-[13px] font-medium text-[#b23a35]">Evidence says this is getting worse</span>}
                        {r.status !== 'closed' && r.live.trend === 'supported' && <span className="mt-1 block text-[13px] text-[#2e7a57]">Evidence supports the treatment</span>}
                        {r.acceptanceExpired && <span className="mt-1 block text-[13px] text-[#b23a35]">Acceptance has run out</span>}
                      </span>
                      <span className="w-full pl-[56px] text-left text-[12.5px] sm:w-auto sm:shrink-0 sm:pl-0 sm:text-right">
                        <span className={`inline sm:block ${r.ownerName ? 'text-[#0e1b2c]' : 'text-[#b23a35]'}`}>{r.ownerName ?? 'No owner'}</span>
                        {r.reviewAt && <span className={`ml-2 inline sm:ml-0 sm:block ${r.overdue ? 'font-medium text-[#b23a35]' : 'text-[#5e6b7b]'}`}>{r.overdue ? 'Review overdue' : 'Review'} {date(r.reviewAt)}</span>}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
              {shown.length === 0 && <li className="rounded-xl border border-[#dde2e8] bg-white px-4 py-5 text-[14px] text-[#5e6b7b]">Nothing matches.</li>}
            </ul>
            {d.dismissed > 0 && <p className="mt-4 text-[12.5px] text-[#5e6b7b]">{d.dismissed} of AIC&apos;s observations were dismissed with a reason and are not suggested again.</p>}
          </section>
        </div>
      )}

      {opened && d && !editing && <RiskDrawer key={opened.id} risk={opened} data={d} onClose={() => setOpenId(null)} onEdit={() => setEditing(opened)} onChanged={load} />}
      {editing && d && <Editor risk={editing === 'new' ? null : editing} controls={d.controls} live={d.live} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {library && d && <LibraryDrawer library={d.library} onClose={() => setLibrary(false)} onAdded={(n) => { setLibrary(false); setNotice(n ? `Added ${n} risk${n === 1 ? '' : 's'} from the library. Set an owner for each.` : 'Those risks are already on your register.'); load(); }} />}
    </DashboardShell>
  );
}
