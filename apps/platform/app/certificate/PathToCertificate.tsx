'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { PHASES, phaseFromCertificationStatus } from '@/lib/phases';

/**
 * Before a certificate exists: the seven stages, where the organisation is,
 * and what stands between it and the next stage, from its own record.
 */
type Vault = { requirements: { state: string }[] };
type Findings = { findings: { status: string }[] };

const WHAT_NEXT: Record<number, string> = {
  0: 'AIC confirms your Division and the requirements that apply to you.',
  1: 'You sign the certification agreement and name your accountable person.',
  2: 'When every requirement has accepted evidence and no finding is open, AIC moves you to analysis.',
  3: 'The AIC engine reviews your decision data: bias, explanation and override patterns.',
  4: 'Your assessor tests the record against the standard and raises any findings.',
  5: 'AIC decides on certification and issues the certificate.',
  6: 'Certified. AIC keeps watching the record, and the certificate stays live while it holds.',
};

export function PathToCertificate({ status }: { status: string | null | undefined }) {
  const phase = phaseFromCertificationStatus(status);
  const [vault, setVault] = useState<Vault | null>(null);
  const [findings, setFindings] = useState<Findings | null>(null);
  useEffect(() => {
    fetch('/api/evidence/vault').then((r) => (r.ok ? r.json() : null)).then(setVault).catch(() => {});
    fetch('/api/v1/findings').then((r) => (r.ok ? r.json() : null)).then(setFindings).catch(() => {});
  }, []);

  const reqs = vault?.requirements ?? [];
  const accepted = reqs.filter((r) => r.state === 'accepted').length;
  const waiting = reqs.filter((r) => r.state === 'submitted').length;
  const sentBack = reqs.filter((r) => r.state === 'needs_more').length;
  const open = (findings?.findings ?? []).filter((f) => f.status === 'OPEN' || f.status === 'RESPONSE_SUBMITTED').length;

  const items = phase === 2 ? [
    { done: reqs.length > 0 && accepted === reqs.length, text: reqs.length ? `Accepted evidence for ${accepted} of ${reqs.length} requirements` : 'Load your requirements', href: '/evidence', note: [waiting ? `${waiting} waiting for review` : '', sentBack ? `${sentBack} sent back for more` : ''].filter(Boolean).join(', ') },
    { done: findings !== null && open === 0, text: open ? `${open} open finding${open === 1 ? '' : 's'} to answer` : 'No open findings', href: '/findings', note: '' },
  ] : [];

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="rounded-2xl border border-[#dde2e8] bg-white p-5 sm:p-6">
        <h2 className="font-serif text-[20px] font-semibold text-[#0e1b2c]">No certificate yet</h2>
        <p className="mt-1 text-[14px] text-[#5e6b7b]">You are at stage {phase + 1} of {PHASES.length}. {WHAT_NEXT[phase]}</p>
        {items.length > 0 && (
          <ul className="mt-5 space-y-3">
            {items.map((i) => (
              <li key={i.text} className="flex items-start gap-3">
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${i.done ? 'bg-[#2e7a57] text-white' : 'border-2 border-[#c9ced6]'}`}>{i.done && <Check className="h-3 w-3" />}</span>
                <span className="text-[14px]">
                  <Link href={i.href} className="font-medium text-[#0e1b2c] hover:text-[#8a6a1f] underline decoration-[#d5dbe2] underline-offset-2">{i.text}</Link>
                  {i.note && <span className="block text-[13px] text-[#5e6b7b]">{i.note}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <ol className="rounded-2xl border border-[#dde2e8] bg-white p-5 sm:p-6">
        {PHASES.map((p) => {
          const state = p.id < phase ? 'done' : p.id === phase ? 'now' : 'later';
          return (
            <li key={p.id} className="relative flex gap-4 pb-5 last:pb-0">
              {p.id < PHASES.length - 1 && <span className={`absolute left-[11px] top-6 h-[calc(100%-12px)] w-px ${state === 'done' ? 'bg-[#a8772a]' : 'bg-[#dde2e8]'}`} aria-hidden />}
              <span className={`relative z-[1] flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${state === 'done' ? 'bg-[#a8772a] text-white' : state === 'now' ? 'bg-[#0e1b2c] text-white ring-4 ring-[#a8772a]/20' : 'border border-[#c9ced6] bg-white text-[#8a95a3]'}`}>
                {state === 'done' ? <Check className="h-3.5 w-3.5" /> : p.id + 1}
              </span>
              <span className="pt-0.5">
                <span className={`block text-[14px] ${state === 'now' ? 'font-semibold text-[#0e1b2c]' : state === 'done' ? 'text-[#0e1b2c]' : 'text-[#8a95a3]'}`}>{p.label}{state === 'now' && <span className="ml-2 text-[12px] font-medium text-[#8a6a1f]">You are here</span>}</span>
                <span className="block text-[12.5px] text-[#8a95a3]">{p.sub.replace(/^& /, 'and ')}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
