'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Eye, Check, Plus } from 'lucide-react';
import DashboardShell from '../../../components/DashboardShell';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { PolicyText } from '../../../components/ui/PolicyText';
import { BUILDERS, missingAnswers, type Answers, type BuilderContext, type Question } from '@/lib/policy-builder';

type Data = {
  key: string; title: string; summary: string; controls: string[];
  questions: Question[]; defaults: Answers; ctx: BuilderContext;
  monitored: { id: string; says: string }[];
};

const chip = (on: boolean) =>
  `inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-3.5 text-left text-[13px] font-medium transition-colors ${on ? 'border-[#0e1b2c] bg-[#0e1b2c] text-white' : 'border-[#dde2e8] bg-white text-[#0e1b2c] hover:border-[#a8772a]'}`;

function PersonField({ value, onChange, people }: { value: string; onChange: (v: string) => void; people: BuilderContext['people'] }) {
  const label = (p: BuilderContext['people'][number]) => `${p.name}${p.jobTitle ? ` (${p.jobTitle})` : ''}`;
  const known = people.some((p) => label(p) === value);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {people.slice(0, 8).map((p) => (
          <button key={p.name} type="button" onClick={() => onChange(label(p))} className={chip(value === label(p))}>
            {p.name}{p.jobTitle && <span className={value === label(p) ? 'text-white/70' : 'text-[#8a95a3]'}>{p.jobTitle}</span>}
          </button>
        ))}
      </div>
      <input value={known ? '' : value} onChange={(e) => onChange(e.target.value)} placeholder="Or type a name and role, e.g. Thandi Nkosi (Head of IT)"
        className="h-11 w-full rounded-xl border border-[#dde2e8] bg-white px-3.5 text-[15px] outline-none focus:border-[#a8772a]" />
    </div>
  );
}

export default function PolicyBuilderPage() {
  const { key } = useParams<{ key: string }>();
  const router = useRouter();
  const [d, setD] = useState<Data | null>(null);
  const [failed, setFailed] = useState('');
  const [a, setA] = useState<Answers>({});
  const [other, setOther] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    fetch(`/api/policies/builder/${key}`, { cache: 'no-store' })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setD(j); setA(j.defaults); })
      .catch((e) => setFailed(e.message || 'Could not load the questions.'));
  }, [key]);

  const builder = BUILDERS[key];
  const preview = useMemo(() => (d && builder ? builder.render(a, d.ctx) : ''), [a, d, builder]);
  const missing = builder ? missingAnswers(builder, a) : [];
  const set = (k: string, v: string | string[]) => setA((x) => ({ ...x, [k]: v }));

  async function create() {
    setBusy(true); setErr('');
    const r = await fetch('/api/policies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ templateKey: key, answers: a }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error ?? 'Could not create the policy.'); return; }
    router.push(`/policies/${j.id}`);
  }

  return (
    <DashboardShell>
      <div className="max-w-6xl">
        {failed && <p className="text-sm text-[#b42318]">{failed} <Link href="/policies" className="text-[#8a6a1f]">Back to policies</Link></p>}
        {!d && !failed && <p className="text-sm text-[#5e6b7b]">Loading…</p>}
        {d && builder && (
          <>
            <PageHeader
              eyebrow={<Link href="/policies" className="hover:underline underline-offset-2">Policies</Link>}
              title={d.title}
              lede={`${d.summary} Answer ${d.questions.length} questions and AIC writes the policy for ${d.ctx.orgName}. Most answers are filled in from what AIC already knows; check them and change any that are wrong.`}
            />
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="space-y-5">
                {d.questions.map((q, i) => (
                  <section key={q.key} className="rounded-xl border border-[#dde2e8] bg-white p-4 sm:p-5">
                    <p className="text-[15px] font-semibold text-[#0e1b2c]"><span className="mr-1.5 text-[#8a95a3]">{i + 1}.</span>{q.label}</p>
                    {q.help && <p className="mt-1 text-[13px] text-[#5e6b7b]">{q.help}</p>}
                    <div className="mt-3">
                      {q.kind === 'person' && <PersonField value={String(a[q.key] ?? '')} onChange={(v) => set(q.key, v)} people={d.ctx.people} />}
                      {q.kind === 'choice' && (
                        <div className="flex flex-wrap gap-2">
                          {q.options.map((o) => <button key={o.value} type="button" onClick={() => set(q.key, o.value)} className={chip(a[q.key] === o.value)}>{o.label}</button>)}
                        </div>
                      )}
                      {q.kind === 'multi' && (() => {
                        const cur = Array.isArray(a[q.key]) ? (a[q.key] as string[]) : [];
                        const toggle = (v: string) => set(q.key, cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]);
                        const extras = cur.filter((v) => !q.options.some((o) => o.value === v));
                        return (
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-2">
                              {[...q.options, ...extras.map((v) => ({ value: v, label: v }))].map((o) => (
                                <button key={o.value} type="button" onClick={() => toggle(o.value)} className={chip(cur.includes(o.value))}>{cur.includes(o.value) && <Check className="h-3.5 w-3.5" />}{o.label}</button>
                              ))}
                            </div>
                            {q.allowOther && (
                              <div className="flex gap-2">
                                <input value={other} onChange={(e) => setOther(e.target.value)} placeholder="Another tool" className="h-10 min-w-0 flex-1 rounded-xl border border-[#dde2e8] bg-white px-3.5 text-[14px] outline-none focus:border-[#a8772a]"
                                  onKeyDown={(e) => { if (e.key === 'Enter' && other.trim()) { e.preventDefault(); set(q.key, [...cur, other.trim()]); setOther(''); } }} />
                                <button type="button" disabled={!other.trim()} onClick={() => { set(q.key, [...cur, other.trim()]); setOther(''); }} className="inline-flex h-10 items-center gap-1 rounded-full border border-[#dde2e8] bg-white px-3.5 text-[13px] font-medium text-[#0e1b2c] disabled:opacity-40"><Plus className="h-4 w-4" />Add</button>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      {q.kind === 'text' && (
                        <input value={String(a[q.key] ?? '')} onChange={(e) => set(q.key, e.target.value)} placeholder={q.placeholder}
                          className="h-11 w-full rounded-xl border border-[#dde2e8] bg-white px-3.5 text-[15px] outline-none focus:border-[#a8772a]" />
                      )}
                    </div>
                  </section>
                ))}

                {d.monitored.length > 0 && (
                  <section className="rounded-xl border border-[#2e7a57]/25 bg-[#2e7a57]/[0.05] p-4 sm:p-5">
                    <p className="text-[15px] font-semibold text-[#0e1b2c]">AIC will check {d.monitored.length} of these promises for you</p>
                    <p className="mt-1 text-[13px] text-[#5e6b7b]">Once published, AIC compares them every night with what your connected systems show, and tells you on Policy vs practice when practice drifts.</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-[#0e1b2c]">{d.monitored.map((m) => <li key={m.id}>{m.says}</li>)}</ul>
                  </section>
                )}

                <div className="sticky bottom-[72px] md:bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-[#dde2e8] bg-white/95 p-3 shadow-[0_8px_24px_-12px_rgba(10,23,40,0.25)] backdrop-blur">
                  <button type="button" onClick={create} disabled={busy || missing.length > 0} className="inline-flex h-11 items-center rounded-full bg-[#0e1b2c] px-5 text-sm font-medium text-white hover:bg-[#22344a] disabled:opacity-40">{busy ? 'Writing…' : 'Create the draft'}</button>
                  <button type="button" onClick={() => setShowPreview(true)} className="inline-flex h-11 items-center gap-1.5 rounded-full border border-[#dde2e8] bg-white px-4 text-sm font-medium text-[#0e1b2c] lg:hidden"><Eye className="h-4 w-4" />Preview</button>
                  <span className="text-[13px] text-[#5e6b7b]">{missing.length ? `Still to answer: ${missing[0]}` : 'You can edit every word before publishing.'}</span>
                  {err && <span className="w-full text-[13px] text-[#b42318]">{err}</span>}
                </div>
              </div>

              <aside className={`${showPreview ? 'fixed inset-0 z-50 overflow-y-auto bg-[#fbfcfd] p-5' : 'hidden'} lg:static lg:block lg:p-0`}>
                <div className="lg:sticky lg:top-24 rounded-xl border border-[#dde2e8] bg-white p-5 sm:p-6 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8a95a3]">Live preview</p>
                    <button type="button" onClick={() => setShowPreview(false)} className="text-[13px] font-medium text-[#8a6a1f] lg:hidden">Close</button>
                  </div>
                  <PolicyText text={preview} />
                </div>
              </aside>
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
