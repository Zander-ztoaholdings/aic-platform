'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import DashboardShell from '../components/DashboardShell';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { SectionCard } from '@/app/components/ui/Eyebrow';

type Does = { source: string; status: 'fail' | 'warn' | 'pass' | 'unknown'; text: string };
type Result = {
  claimId: string; policyId: string; policyTitle: string; version: number; section: string;
  says: string; verdict: 'contradicted' | 'partly' | 'consistent' | 'not_observed'; does: Does[]; acceptedBy: string;
};
type Data = {
  results: Result[];
  summary: { total: number; contradicted: number; partly: number; consistent: number; notObserved: number };
  publishedPolicies: number; adoptedTemplates: number; connectedChecks: number;
};

const VERDICT: Record<Result['verdict'], { label: string; chip: string }> = {
  contradicted: { label: 'Contradicted', chip: 'bg-[#b42318]/10 text-[#b42318]' },
  partly: { label: 'Partly true', chip: 'bg-[#b45309]/10 text-[#b45309]' },
  consistent: { label: 'Matches', chip: 'bg-[#2f7d4f]/10 text-[#2f7d4f]' },
  not_observed: { label: 'Not yet observed', chip: 'bg-[#eef1f5] text-[#5e6b7b]' },
};
const DOT: Record<Does['status'], string> = { fail: 'bg-[#b42318]', warn: 'bg-[#b45309]', pass: 'bg-[#2f7d4f]', unknown: 'bg-[#c5cdd6]' };

export default function PracticePage() {
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const [show, setShow] = useState<'issues' | 'all'>('issues');

  useEffect(() => {
    fetch('/api/says-vs-does', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  const list = data ? (show === 'issues' ? data.results.filter((r) => r.verdict === 'contradicted' || r.verdict === 'partly') : data.results) : [];

  return (
    <DashboardShell>
      <div className="max-w-4xl">
        <PageHeader
          eyebrow="Compliance tracking"
          title="Policy versus practice"
          lede="What your published policies promise, checked against what your connected systems and your AIC record actually show. A contradiction is not a finding; it is where your own words and your own systems disagree, so you can fix one or the other before an assessor asks."
        />

        {failed && <p className="text-sm text-[#b42318]">Could not load this view. Try refreshing.</p>}
        {!data && !failed && <p className="text-sm text-[#5e6b7b]">Loading…</p>}

        {data && data.publishedPolicies === 0 && (
          <SectionCard>
            <p className="text-sm text-[#0e1b2c] font-medium">Nothing to compare yet.</p>
            <p className="mt-1 text-[13px] leading-relaxed text-[#5e6b7b]">
              This view starts working once you have published a policy. Adopt a template, fill in the parts in brackets, and publish it.
            </p>
            <Link href="/policies" className="mt-4 inline-flex h-11 items-center rounded-full bg-[#0e1b2c] px-5 text-sm font-medium text-white hover:bg-[#22344a]">Go to policies</Link>
          </SectionCard>
        )}

        {data && data.publishedPolicies > 0 && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                { n: data.summary.contradicted, l: 'Contradicted', c: 'text-[#b42318]' },
                { n: data.summary.partly, l: 'Partly true', c: 'text-[#b45309]' },
                { n: data.summary.consistent, l: 'Match', c: 'text-[#2f7d4f]' },
                { n: data.summary.notObserved, l: 'Not yet observed', c: 'text-[#5e6b7b]' },
              ].map((s) => (
                <SectionCard key={s.l} className="p-4">
                  <div className={`font-serif text-[28px] font-semibold leading-none ${s.c}`}>{s.n}</div>
                  <div className="mt-2 text-[13px] text-[#5e6b7b]">{s.l}</div>
                </SectionCard>
              ))}
            </div>

            {data.connectedChecks === 0 && (
              <p className="mb-5 rounded-xl border border-[#dde2e8] bg-white px-4 py-3 text-[13px] leading-relaxed text-[#5e6b7b]">
                Most promises can only be checked against connected systems. <Link href="/integrations" className="font-medium text-[#8a6a1f] hover:underline underline-offset-2">Connect GitHub, Microsoft 365 or an AI provider</Link> and this view fills in on the next check.
              </p>
            )}

            <div className="mb-4 inline-flex rounded-full border border-[#dde2e8] bg-white p-1">
              {(['issues', 'all'] as const).map((k) => (
                <button key={k} onClick={() => setShow(k)} className={`h-9 rounded-full px-4 text-sm font-medium ${show === k ? 'bg-[#0e1b2c] text-white' : 'text-[#5e6b7b] hover:text-[#0e1b2c]'}`}>
                  {k === 'issues' ? 'Needs attention' : 'Every promise'}
                </button>
              ))}
            </div>

            {list.length === 0 ? (
              <SectionCard><p className="text-sm text-[#5e6b7b]">{show === 'issues' ? 'Nothing your systems show contradicts your published policies.' : 'No promises to compare yet.'}</p></SectionCard>
            ) : (
              <ul className="space-y-3 lift-children">
                {list.map((r) => (
                  <li key={`${r.policyId}-${r.claimId}`} className="rounded-xl border border-[#dde2e8] bg-white p-4 sm:p-5">
                    <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#5e6b7b]">
                      <span className={`rounded-full px-2.5 py-0.5 font-medium ${VERDICT[r.verdict].chip}`}>{VERDICT[r.verdict].label}</span>
                      <Link href={`/policies/${r.policyId}`} className="hover:text-[#8a6a1f]">{r.policyTitle}, version {r.version}</Link>
                      <span>· {r.section}</span>
                      <span>· accepted by {r.acceptedBy}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <div className="text-[12px] font-medium text-[#8a6a1f]">Your policy says</div>
                        <p className="mt-1 text-sm leading-relaxed text-[#0e1b2c]">{r.says}</p>
                      </div>
                      <div>
                        <div className="text-[12px] font-medium text-[#8a6a1f]">Your systems show</div>
                        {r.does.length === 0 ? (
                          <p className="mt-1 text-sm text-[#5e6b7b]">Nothing connected checks this yet.</p>
                        ) : (
                          <ul className="mt-1 space-y-1.5">
                            {r.does.map((d, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-[#0e1b2c]">
                                <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${DOT[d.status]}`} />
                                <span><span className="text-[#5e6b7b]">{d.source}:</span> {d.text}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                    {(r.verdict === 'contradicted' || r.verdict === 'partly') && (
                      <p className="mt-3 text-[13px] text-[#5e6b7b]">
                        Either fix the practice (<Link href="/checks" className="font-medium text-[#8a6a1f] hover:underline underline-offset-2">see the check and how to fix it</Link>) or change the policy to say what you really do, and publish the new version.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}
