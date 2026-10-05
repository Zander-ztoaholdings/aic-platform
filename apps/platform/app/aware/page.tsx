'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Download, ExternalLink, Loader2, RotateCcw, ShieldCheck, UserCheck } from 'lucide-react';
import DashboardShell from '../components/DashboardShell';
import { ACCOUNTABLE_PERSON_DECLARATION, SUBMISSION_ATTESTATION, BADGE_RULES_URL } from '@/lib/aware/declarations';
import { Eyebrow, SectionCard } from '../components/ui/Eyebrow';

/**
 * AIC Aware, inside the platform.
 *
 * Three steps — a named accountable person, the questions (saved as you go),
 * and a declaration — and then a badge with a code anyone can verify. The
 * website keeps its free anonymous self-check; only this page issues badges,
 * because only here is there a registered organisation behind the claim.
 */

interface Option { text: string; value: number }
interface Question { id: string; category: string; text: string; rationale: string | null; requirements: string[]; options: Option[] }
interface Category { key: string; name: string; weight: number; purpose?: string }
interface Badge {
  code: string; orgNameAtIssue: string; issuedAt: string; expiresAt: string;
  listed: boolean; questionSetVersion: string; status: 'valid' | 'expired' | 'revoked';
}
interface Result {
  score: number; tier: string; indicatedDivision: number | null; indicatedDivisionName: string | null;
  applicableCount: number; gapCodes: string[]; flagshipGapCodes: string[];
}
interface AwareState {
  instrument: { version: string; questions: Question[]; categories: Category[] };
  accountablePerson: { name: string; jobTitle: string | null; email: string; declarationAcceptedAt: string } | null;
  inProgress: { id: string; answers: Record<string, number>; updatedAt: string } | null;
  lastSubmitted: { id: string; submittedAt: string; questionSetVersion: string; result: Result | null } | null;
  badge: Badge | null;
  canAnswer: boolean;
  canDeclare: boolean;
  emailVerified: boolean;
  organisation: string;
}

function webBase(): string {
  const configured = process.env.NEXT_PUBLIC_WEB_URL?.replace(/\/+$/, '');
  if (configured && !/localhost|127\.0\.0\.1/.test(configured)) return configured;
  return 'https://aiccertified.cloud';
}

const fmt = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

const input =
  'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-aic-navy outline-none transition focus:border-aic-gold focus:ring-4 focus:ring-amber-100';
const label = 'mb-1.5 block text-[12.5px] font-semibold first-cap text-gray-400';

export default function AwarePage() {
  const [state, setState] = useState<AwareState | null>(null);
  const [error, setError] = useState('');
  const [retaking, setRetaking] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/aware', { cache: 'no-store' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not load AIC Aware.');
      setState(await res.json());
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const showBadge = !!state?.badge && state.badge.status === 'valid' && !state.inProgress && !retaking;

  return (
    <DashboardShell>
      <div className="mx-auto max-w-3xl">
        <Eyebrow>AIC Certification · AIC Aware</Eyebrow>
        <h1 className="font-serif text-[30px] md:text-[34px] leading-tight font-semibold text-[#0e1b2c]">AIC Aware</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-gray-500">
          A self-declaration of where your organisation stands on accountable AI, made by a named person
          and verifiable by anyone. It is not certification, and your badge says so.
        </p>

        {error && <div className="mt-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {!state && !error && (
          <div className="mt-10 flex items-center gap-2 text-sm text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading</div>
        )}

        {state && showBadge && (
          <BadgePanel state={state} onChanged={load} onRetake={() => setRetaking(true)} />
        )}

        {state && !showBadge && (
          <Flow state={state} onChanged={async () => { await load(); setRetaking(false); }} />
        )}
      </div>
    </DashboardShell>
  );
}

// ── The flow ──────────────────────────────────────────────────────────────

function StepHeader({ n, title, done, active }: { n: number; title: string; done: boolean; active: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
          done ? 'bg-emerald-500 text-white' : active ? 'bg-aic-navy text-white' : 'bg-gray-100 text-gray-400'
        }`}
      >
        {done ? <Check className="h-3.5 w-3.5" /> : n}
      </span>
      <h2 className={`text-[17px] font-semibold ${active || done ? 'text-aic-navy' : 'text-gray-400'}`}>{title}</h2>
    </div>
  );
}

function Flow({ state, onChanged }: { state: AwareState; onChanged: () => Promise<void> }) {
  const { instrument } = state;
  const [answers, setAnswers] = useState<Record<string, number>>(state.inProgress?.answers ?? {});
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const answered = instrument.questions.filter((q) => answers[q.id] !== undefined).length;
  const total = instrument.questions.length;
  const complete = answered === total;
  const hasPerson = !!state.accountablePerson;

  const save = useCallback((next: Record<string, number>) => {
    if (timer.current) clearTimeout(timer.current);
    setSaving('saving');
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/aware', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers: next }),
        });
        setSaving(res.ok ? 'saved' : 'error');
      } catch {
        setSaving('error');
      }
    }, 500);
  }, []);

  function choose(id: string, value: number) {
    if (!state.canAnswer) return;
    const next = { ...answers, [id]: value };
    setAnswers(next);
    save(next);
  }

  const grouped = useMemo(() => {
    const byCat = new Map<string, Question[]>();
    for (const q of instrument.questions) byCat.set(q.category, [...(byCat.get(q.category) ?? []), q]);
    return instrument.categories
      .filter((c) => byCat.has(c.key))
      .map((c) => ({ category: c, questions: byCat.get(c.key)! }));
  }, [instrument]);

  return (
    <div className="mt-8 space-y-5">
      {state.badge && state.badge.status !== 'valid' && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Your badge {state.badge.code} has {state.badge.status === 'expired' ? 'expired' : 'been revoked'}. Complete AIC Aware again to be issued a new one.
        </div>
      )}

      <SectionCard className="!rounded-2xl !p-6">
        <StepHeader n={1} title="Your accountable person" done={hasPerson} active={!hasPerson} />
        {hasPerson ? (
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3">
            <UserCheck className="h-4 w-4 text-emerald-600" />
            <div className="text-sm">
              <span className="font-medium text-aic-navy">{state.accountablePerson!.name}</span>
              {state.accountablePerson!.jobTitle && <span className="text-gray-500"> · {state.accountablePerson!.jobTitle}</span>}
              <span className="text-gray-400"> · declared {fmt(state.accountablePerson!.declarationAcceptedAt)}</span>
            </div>
          </div>
        ) : state.canDeclare ? (
          <AccountablePersonForm orgName={state.organisation} onDone={onChanged} />
        ) : (
          <p className="mt-3 text-sm text-gray-500">An organisation admin needs to name the accountable person first.</p>
        )}
      </SectionCard>

      <SectionCard className="!rounded-2xl !p-6">
        <div className="flex items-center justify-between gap-4">
          <StepHeader n={2} title="The questions" done={complete} active={hasPerson && !complete} />
          <span className="text-xs text-gray-400">
            {saving === 'saving' ? 'Saving…' : saving === 'saved' ? 'Saved' : saving === 'error' ? 'Not saved — check your connection' : ''}
          </span>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-aic-gold transition-all duration-500 ease-out" style={{ width: `${(answered / total) * 100}%` }} />
        </div>
        <p className="mt-2 text-xs text-gray-400">{answered} of {total} answered · question set {instrument.version}</p>

        <div className={`mt-6 space-y-10 ${hasPerson ? '' : 'pointer-events-none opacity-40'}`}>
          {grouped.map(({ category, questions }) => (
            <section key={category.key}>
              <h3 className="text-[13px] font-semibold first-cap text-aic-gold">{category.name}</h3>
              {category.purpose && <p className="mt-1 text-sm text-gray-500">{category.purpose}</p>}
              <div className="mt-5 space-y-7">
                {questions.map((q) => (
                  <div key={q.id}>
                    <p className="text-[15px] font-medium leading-snug text-aic-navy">{q.text}</p>
                    {q.rationale && <p className="mt-1.5 text-[13px] leading-relaxed text-gray-400">{q.rationale}</p>}
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {q.options.map((o) => {
                        const selected = answers[q.id] === o.value;
                        return (
                          <button
                            key={o.value}
                            type="button"
                            disabled={!state.canAnswer}
                            onClick={() => choose(q.id, o.value)}
                            className={`rounded-xl border px-3.5 py-2.5 text-left text-sm transition-all duration-200 ${
                              selected
                                ? 'border-aic-navy bg-aic-navy text-white shadow-[0_6px_18px_rgba(10,23,40,0.18)]'
                                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {o.text}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </SectionCard>

      <SectionCard className="!rounded-2xl !p-6">
        <StepHeader n={3} title="Declare and receive your badge" done={false} active={hasPerson && complete} />
        {hasPerson && complete && !state.emailVerified ? (
          <VerifyEmailPrompt />
        ) : hasPerson && complete ? (
          state.canDeclare ? <Declare orgName={state.organisation} personName={state.accountablePerson!.name} onDone={onChanged} /> : (
            <p className="mt-3 text-sm text-gray-500">An organisation admin needs to make the declaration.</p>
          )
        ) : (
          <p className="mt-3 text-sm text-gray-400">Available once your accountable person is named and every question is answered.</p>
        )}
      </SectionCard>
    </div>
  );
}

function AccountablePersonForm({ orgName, onDone }: { orgName: string; onDone: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [email, setEmail] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/accountable-person', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), jobTitle: jobTitle.trim() || undefined, email: email.trim(), accepted }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not record the declaration.');
      await onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-4">
      <p className="text-sm text-gray-500">A named individual, not a role. They answer for how your organisation uses AI.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className={label}>Full name</label><input className={input} value={name} onChange={(e) => setName(e.target.value)} required /></div>
        <div><label className={label}>Job title</label><input className={input} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} /></div>
      </div>
      <div><label className={label}>Email</label><input type="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
      <label className="flex items-start gap-3 text-sm text-gray-600">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#0A1728]" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
        <span>{ACCOUNTABLE_PERSON_DECLARATION.text(orgName)}</span>
      </label>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button disabled={busy || !accepted} className="rounded-full bg-aic-navy px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#13233b] disabled:opacity-40">
        {busy ? 'Saving…' : 'Name accountable person'}
      </button>
    </form>
  );
}

function VerifyEmailPrompt() {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  async function resend() {
    setBusy(true);
    const res = await fetch('/api/auth/verify-email/resend', { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    setMsg(data.message || data.error || (data.alreadyVerified ? 'Already confirmed — refresh this page.' : ''));
    setBusy(false);
  }
  return (
    <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3.5 text-sm text-amber-900">
      <p>Confirm your email address to receive the badge. We sent a link when you registered.</p>
      <button onClick={resend} disabled={busy} className="mt-2 font-medium underline underline-offset-2 disabled:opacity-50">
        {busy ? 'Sending…' : 'Send the link again'}
      </button>
      {msg && <p className="mt-2 text-amber-800">{msg}</p>}
    </div>
  );
}

function Declare({ orgName, personName, onDone }: { orgName: string; personName: string; onDone: () => Promise<void> }) {
  const [attested, setAttested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/aware/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attested: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not submit.');
      await onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 space-y-4">
      <label className="flex items-start gap-3 text-sm text-gray-600">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#0A1728]" checked={attested} onChange={(e) => setAttested(e.target.checked)} />
        <span>
          {SUBMISSION_ATTESTATION.text(orgName, personName)}{' '}
          <a href={BADGE_RULES_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Read the badge rules</a>.
        </span>
      </label>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button onClick={submit} disabled={!attested || busy} className="inline-flex items-center gap-2 rounded-full bg-aic-navy px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#13233b] disabled:opacity-40">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
        Submit and issue badge
      </button>
    </div>
  );
}

// ── The badge ─────────────────────────────────────────────────────────────

function BadgePanel({ state, onChanged, onRetake }: { state: AwareState; onChanged: () => Promise<void>; onRetake: () => void }) {
  const badge = state.badge!;
  const web = webBase();
  const imageUrl = `${web}/api/aware-badge/${badge.code}`;
  // The badge's entry in the AIC public registry. Every embed links here.
  const verifyUrl = `${web}/registry/aware/${badge.code}`;
  const embed = `<a href="${verifyUrl}" target="_blank" rel="noopener" title="Verify this badge in the AIC Public Registry"><img src="${imageUrl}" alt="${badge.orgNameAtIssue} — AIC Aware badge ${badge.code}, verify in the AIC Public Registry" width="400" height="120" style="max-width:100%;height:auto" /></a>`;
  const [linkCopied, setLinkCopied] = useState(false);
  const [copied, setCopied] = useState(false);
  const [listed, setListed] = useState(badge.listed);
  const [busy, setBusy] = useState(false);
  const result = state.lastSubmitted?.result ?? null;

  async function toggleListed() {
    setBusy(true);
    const next = !listed;
    const res = await fetch('/api/aware/badge', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listed: next }),
    });
    if (res.ok) setListed(next);
    setBusy(false);
    await onChanged();
  }

  async function retake() {
    await fetch('/api/aware', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: {} }),
    });
    onRetake();
    await onChanged();
  }

  return (
    <div className="mt-8 space-y-5">
      <div className="overflow-hidden rounded-xl bg-gradient-to-br from-[#0A1728] via-[#10233d] to-[#1b3350] p-5 md:p-8 text-white shadow-[0_20px_50px_rgba(10,23,40,0.25)]">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="text-[12.5px] font-semibold first-cap text-aic-gold-light">AIC Aware · self-declared</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight">{badge.orgNameAtIssue}</div>
            <div className="mt-1 font-mono text-sm text-white/70">{badge.code}</div>
          </div>
          <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-medium text-emerald-300">Valid</span>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div><div className="text-white/50">Issued</div><div className="mt-0.5">{fmt(badge.issuedAt)}</div></div>
          <div><div className="text-white/50">Valid until</div><div className="mt-0.5">{fmt(badge.expiresAt)}</div></div>
          <div><div className="text-white/50">Accountable</div><div className="mt-0.5">{state.accountablePerson?.name ?? '—'}</div></div>
        </div>
      </div>

      <SectionCard className="!rounded-2xl !p-6">
        <h2 className="text-[17px] font-semibold text-aic-navy">Use your badge</h2>
        <div className="mt-4 flex flex-wrap items-center gap-5">
          <a href={verifyUrl} target="_blank" rel="noopener noreferrer" title="Open the registry entry">
            <img src={imageUrl} alt={`AIC Aware badge ${badge.code}`} width={300} height={90} className="rounded-lg border border-gray-100" />
          </a>
          <div className="flex flex-wrap gap-2">
            <a href={`${imageUrl}?download=1`} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-4 py-2 text-sm text-aic-navy hover:bg-gray-50">
              <Download className="h-4 w-4" /> Download
            </a>
            <a href={verifyUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-4 py-2 text-sm text-aic-navy hover:bg-gray-50">
              <ExternalLink className="h-4 w-4" /> Registry entry
            </a>
            <button
              onClick={() => { navigator.clipboard.writeText(verifyUrl); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 1500); }}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-4 py-2 text-sm text-aic-navy hover:bg-gray-50"
            >
              {linkCopied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />} Copy registry link
            </button>
          </div>
        </div>
        <label className={`${label} mt-6`}>Embed on your website</label>
        <div className="relative">
          <pre className="overflow-x-auto rounded-xl bg-gray-50 p-4 pr-12 text-xs text-gray-600">{embed}</pre>
          <button
            onClick={() => { navigator.clipboard.writeText(embed); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="absolute right-3 top-3 rounded-lg p-1.5 text-gray-400 hover:bg-white hover:text-aic-navy"
            aria-label="Copy embed code"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          Embedded, the badge links to its entry in the AIC Public Registry, where anyone can check it is yours and current.
          A downloaded image cannot carry a link, so the code and the registry address are printed on it — for slides,
          PDFs and email signatures, link the image to the registry link above.
        </p>
      </SectionCard>

      <SectionCard className="!rounded-2xl !p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-[17px] font-semibold text-aic-navy">Public directory</h2>
            <p className="mt-1 text-sm text-gray-500">List {badge.orgNameAtIssue} in the AIC Aware directory on aiccertified.cloud. No scores are shown.</p>
          </div>
          <button
            role="switch"
            aria-checked={listed}
            disabled={busy || !state.canDeclare}
            onClick={toggleListed}
            className={`relative h-7 w-12 flex-shrink-0 rounded-full transition-colors duration-300 ${listed ? 'bg-emerald-500' : 'bg-gray-200'} disabled:opacity-50`}
          >
            <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all duration-300 ${listed ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>
      </SectionCard>

      {result && (
        <SectionCard className="!rounded-2xl !p-6">
          <h2 className="text-[17px] font-semibold text-aic-navy">What your answers indicate</h2>
          <p className="mt-1 text-xs text-gray-400">Private to your organisation. Not shown on the badge or in the directory.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-gray-50 p-4"><div className="text-xs text-gray-400">Readiness</div><div className="mt-1 text-lg font-semibold text-aic-navy">{result.tier}</div></div>
            <div className="rounded-xl bg-gray-50 p-4"><div className="text-xs text-gray-400">Indicated Division</div><div className="mt-1 text-lg font-semibold text-aic-navy">{result.indicatedDivisionName ?? '—'}</div></div>
            <div className="rounded-xl bg-gray-50 p-4"><div className="text-xs text-gray-400">Gaps against the standard</div><div className="mt-1 text-lg font-semibold text-aic-navy">{result.gapCodes.length} of {result.applicableCount}</div></div>
          </div>
          {result.gapCodes.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {result.gapCodes.map((c) => (
                <span key={c} className={`rounded-md px-2 py-0.5 font-mono text-[11px] ${result.flagshipGapCodes.includes(c) ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>{c}</span>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {state.canAnswer && (
        <button onClick={retake} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-aic-navy">
          <RotateCcw className="h-4 w-4" /> Answer again (your current badge stays valid until you submit)
        </button>
      )}
    </div>
  );
}
