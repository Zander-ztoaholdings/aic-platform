'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import DashboardShell from '../components/DashboardShell';
import { Eyebrow } from '../components/ui/Eyebrow';
import type { EvaluatedControl, Framework, ControlStatus } from '@/lib/controls';

/**
 * Controls by framework, each with the evidence on the platform that speaks
 * to it. A summary of evidence, not a conformity decision — the page says so.
 */

const STATUS: Record<ControlStatus, { label: string; dot: string }> = {
  gap: { label: 'Gap', dot: 'bg-[#b23a35]' },
  partial: { label: 'Partly evidenced', dot: 'bg-[#a8772a]' },
  no_evidence: { label: 'No evidence yet', dot: 'bg-[#c9ced6]' },
  evidenced: { label: 'Evidenced', dot: 'bg-[#2e7a57]' },
};
const SRC: Record<string, string> = { pass: 'text-[#2e7a57]', fail: 'text-[#b23a35]', pending: 'text-[#8a6a1f]', none: 'text-[#8a95a3]' };
const SRC_LABEL: Record<string, string> = { pass: 'Passing', fail: 'Failing', pending: 'In progress', none: 'Nothing yet' };
const ORDER: ControlStatus[] = ['gap', 'partial', 'no_evidence', 'evidenced'];

export default function ControlsPage() {
  const [data, setData] = useState<{ frameworks: { key: Framework; name: string; note: string }[]; controls: EvaluatedControl[] } | null>(null);
  const [fw, setFw] = useState<Framework>('aic');
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/controls', { cache: 'no-store' })
      .then(async (r) => { const b = await r.json(); if (!r.ok) throw new Error(b.error); setData(b); })
      .catch((e) => setError(e.message || 'Could not load controls.'));
  }, []);

  const shown = useMemo(() => (data?.controls ?? []).filter((c) => c.framework === fw), [data, fw]);
  const evidenced = shown.filter((c) => c.status === 'evidenced').length;
  const gaps = shown.filter((c) => c.status === 'gap').length;
  const sorted = useMemo(() => (fw === 'aic' ? shown : [...shown].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status))), [shown, fw]);
  const framework = data?.frameworks.find((f) => f.key === fw);

  return (
    <DashboardShell>
      <div className="max-w-[920px] space-y-6">
        <header>
          <Eyebrow>Compliance tracking</Eyebrow>
          <h1 className="font-serif text-[30px] md:text-[34px] leading-tight font-semibold text-[#0e1b2c]">Controls</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5e6b7b] max-w-2xl">
            Each control in the frameworks that apply to you, and what on the platform is evidence for it: automated checks, your policies, and
            evidence AIC has accepted. Evidenced is not the same as certified; only an assessment decides that.
          </p>
        </header>
        {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-[14px] text-red-700">{error}</div>}
        {!data && !error && <p className="text-[14px] text-[#5e6b7b]">Loading…</p>}
        {data && (
          <>
            <div className="flex gap-2 overflow-x-auto -mx-5 px-5 sm:mx-0 sm:px-0">
              {data.frameworks.map((f) => (
                <button key={f.key} onClick={() => setFw(f.key)} className={`h-10 sm:h-9 px-4 rounded-full text-[14px] font-medium whitespace-nowrap border ${fw === f.key ? 'bg-[#0e1b2c] text-white border-[#0e1b2c]' : 'bg-white text-[#5e6b7b] border-[#dde2e8]'}`}>
                  {f.name}
                </button>
              ))}
            </div>
            {shown.length > 0 && (
              <div>
                <p className="text-[15px] text-[#0e1b2c]">
                  <span className="font-semibold">{evidenced} of {shown.length}</span> controls evidenced{gaps > 0 ? <>, <span className="text-[#b23a35]">{gaps} with a gap</span></> : null}.
                </p>
                <div className="mt-2 h-1.5 rounded-full bg-[#eef1f5] overflow-hidden max-w-[420px]" aria-hidden>
                  <div className="h-full bg-[#a8772a]" style={{ width: `${(evidenced / shown.length) * 100}%` }} />
                </div>
                <p className="mt-2 text-[13px] text-[#5e6b7b]">{framework?.note}</p>
              </div>
            )}
            {shown.length === 0 && (
              <div className="rounded-xl border border-dashed border-[#c9ced6] bg-white p-6 text-[14px] text-[#5e6b7b]">
                {fw === 'aic' ? <>No requirements are loaded yet. <Link href="/evidence" className="text-[#8a6a1f] hover:underline">Load them in the Evidence Vault</Link>.</> : 'Nothing to show.'}
              </div>
            )}
            {shown.length > 0 && (
              <section className="bg-white border border-[#dde2e8] rounded-xl divide-y divide-[#e6e9ee] overflow-hidden">
                {sorted.map((c) => {
                  const k = `${c.framework}:${c.id}`;
                  const isOpen = open === k;
                  return (
                    <div key={k}>
                      <button onClick={() => setOpen(isOpen ? null : k)} aria-expanded={isOpen} className="w-full text-left px-4 sm:px-5 py-3.5 flex items-start gap-3 hover:bg-[#fafbfc]">
                        <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${STATUS[c.status].dot}`} aria-hidden />
                        <span className="flex-1 min-w-0">
                          <span className="block text-[14.5px] text-[#0e1b2c]"><span className="font-semibold tabular-nums">{c.id}</span> {c.title}</span>
                          <span className="block text-[13px] text-[#5e6b7b] mt-0.5">{STATUS[c.status].label}</span>
                        </span>
                        <ChevronDown className={`w-4 h-4 mt-1 text-[#8a95a3] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isOpen && (
                        <ul className="px-4 sm:px-5 pb-4 sm:pl-[44px] space-y-1.5">
                          {c.sources.map((s, i) => (
                            <li key={i} className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-3 text-[13.5px]">
                              <Link href={s.href} className="flex-1 text-[#0e1b2c] hover:text-[#8a6a1f] underline decoration-[#d5dbe2] underline-offset-2">{s.label}</Link>
                              <span className={SRC[s.status]}>{SRC_LABEL[s.status]}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </section>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}
