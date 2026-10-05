'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, Check, X } from 'lucide-react';
import DashboardShell from '../../components/DashboardShell';
import { PageHeader } from '@/app/components/ui/PageHeader';

type Mod = { key: string; title: string; summary: string; minutes: number; sections: { heading: string; body: string[] }[]; quiz: { q: string; options: string[] }[] };
type Result = { correct: number; total: number; passed: boolean; score: number; feedback: { correct: boolean; answer?: number; why?: string }[] };

export default function ModulePage() {
  const { key } = useParams<{ key: string }>();
  const [m, setM] = useState<Mod | null>(null);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/training/${key}`, { cache: 'no-store' }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setM(j); setAnswers(j.quiz.map(() => null)); }).catch((e) => setError(e.message || 'Could not load the module.'));
  }, [key]);

  async function submit() {
    setBusy(true);
    const r = await fetch(`/api/training/${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setError(j.error ?? 'Could not submit.'); return; }
    setResult(j);
    requestAnimationFrame(() => document.getElementById('result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
  const retake = () => { setResult(null); setAnswers((a) => a.map(() => null)); document.getElementById('quiz')?.scrollIntoView({ behavior: 'smooth' }); };

  return (
    <DashboardShell>
      <Link href="/training" className="mb-3 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-[#5e6b7b] hover:text-[#0e1b2c]"><ArrowLeft className="h-4 w-4" />All training</Link>
      {error && <p className="text-sm text-[#b42318]">{error}</p>}
      {!m && !error && <p className="text-sm text-[#5e6b7b]">Loading…</p>}
      {m && (
        <div className="max-w-3xl">
          <PageHeader eyebrow="Training" title={m.title} lede={`${m.summary} About ${m.minutes} minutes.`} />
          <article className="space-y-6 rounded-2xl border border-[#dde2e8] bg-white p-6 md:p-8">
            {m.sections.map((s) => (
              <section key={s.heading}>
                <h2 className="font-serif text-[20px] font-semibold text-[#0e1b2c]">{s.heading}</h2>
                <div className="mt-2 space-y-2.5 text-[15.5px] leading-relaxed text-[#2b3a4d]">{s.body.map((p) => <p key={p}>{p}</p>)}</div>
              </section>
            ))}
          </article>

          <section id="quiz" className="mt-6 rounded-2xl border border-[#dde2e8] bg-white p-6 md:p-8">
            <h2 className="font-serif text-[20px] font-semibold text-[#0e1b2c]">Four questions</h2>
            <p className="mt-0.5 text-[14px] text-[#5e6b7b]">Three right is a pass.</p>
            <ol className="mt-5 space-y-6">
              {m.quiz.map((q, i) => {
                const fb = result?.feedback[i];
                return (
                  <li key={q.q}>
                    <p className="text-[15px] font-medium text-[#0e1b2c]">{i + 1}. {q.q}</p>
                    <div className="mt-2 grid gap-2">
                      {q.options.map((o, j) => {
                        const picked = answers[i] === j;
                        const right = fb?.answer === j;
                        const tone = fb
                          ? right ? 'border-[#2e7a57] bg-[#2e7a57]/[0.06]' : picked && !fb.correct ? 'border-[#b23a35] bg-[#b23a35]/[0.05]' : 'border-[#eef1f5] opacity-70'
                          : picked ? 'border-[#0e1b2c] bg-[#0e1b2c]/[0.04]' : 'border-[#dde2e8] hover:border-[#a8772a]';
                        return (
                          <button key={o} type="button" disabled={!!result} onClick={() => setAnswers((a) => a.map((x, k) => (k === i ? j : x)))}
                            className={`flex min-h-[44px] items-center gap-2.5 rounded-xl border px-3.5 py-2 text-left text-[14.5px] text-[#0e1b2c] ${tone}`}>
                            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${picked ? 'border-[#0e1b2c] bg-[#0e1b2c] text-white' : 'border-[#c9ced6]'}`}>{picked && <Check className="h-3 w-3" />}</span>{o}
                          </button>
                        );
                      })}
                    </div>
                    {fb && (
                      <p className={`mt-2 flex gap-1.5 text-[13.5px] ${fb.correct ? 'text-[#2e7a57]' : 'text-[#b23a35]'}`}>
                        {fb.correct ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : <X className="mt-0.5 h-4 w-4 shrink-0" />}
                        <span>{fb.correct ? 'Right.' : 'Not quite.'}{fb.why ? ` ${fb.why}` : ''}</span>
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
            {!result && (
              <button type="button" onClick={submit} disabled={busy || answers.some((a) => a === null)} className="mt-6 inline-flex h-11 items-center rounded-full bg-[#0e1b2c] px-5 text-sm font-medium text-white hover:bg-[#22344a] disabled:opacity-40">{busy ? 'Checking…' : 'Check my answers'}</button>
            )}
            {result && (
              <div id="result" className={`mt-6 rounded-xl p-4 ${result.passed ? 'bg-[#2e7a57]/[0.07]' : 'bg-[#b45309]/[0.07]'}`}>
                <p className="text-[15px] font-semibold text-[#0e1b2c]">{result.passed ? `Passed: ${result.correct} of ${result.total}. It is recorded against your name.` : `${result.correct} of ${result.total}. Have another look at the module and try again.`}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {result.passed ? <Link href="/training" className="inline-flex h-10 items-center rounded-full bg-[#0e1b2c] px-4 text-sm font-medium text-white hover:bg-[#22344a]">Back to training</Link>
                    : <button type="button" onClick={retake} className="inline-flex h-10 items-center rounded-full bg-[#0e1b2c] px-4 text-sm font-medium text-white hover:bg-[#22344a]">Try again</button>}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </DashboardShell>
  );
}
