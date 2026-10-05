'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronRight, MessageSquare, ShieldAlert } from 'lucide-react';
import DashboardShell from '../components/DashboardShell';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { SectionCard } from '@/app/components/ui/Eyebrow';

/**
 * Help, pointing at the real places things are done.
 *
 * The old page was a standalone "Autonomous Support Center" outside the
 * workspace, with four guide titles that opened nothing, a chat button that
 * did nothing, and a "System Status: Operational" panel that was hardcoded.
 * Status is now read from /api/health, and every row goes somewhere real.
 */

const TASKS = [
  { href: '/evidence', title: 'File evidence for a requirement', body: 'Open the Evidence Vault, find the requirement, and upload the document. An assessor reviews every file.' },
  { href: '/integrations', title: 'Connect GitHub, Microsoft 365 or an AI provider', body: 'Read-only access. AIC checks them every night and shows what to fix.' },
  { href: '/settings/keys', title: 'Record decisions from your systems', body: 'Create an API key and send each automated decision, including human overrides.' },
  { href: '/policies', title: 'Adopt and publish a policy', body: 'Start from a template, fill in the parts in brackets, publish, and ask your team to accept it.' },
  { href: '/findings', title: 'Respond to an assessor finding', body: 'Each finding shows what was raised and where to submit the corrective action.' },
  { href: '/overview', title: 'Change your accountable person or AI systems', body: 'Your AI estate: each system, its purpose, and the person accountable for it.' },
];

type Health = { status: string; checks: Record<string, { status: string }> };

export default function SupportPage() {
  const [health, setHealth] = useState<Health | null>(null);
  useEffect(() => {
    fetch('/api/health', { cache: 'no-store' }).then((r) => r.json()).then(setHealth).catch(() => setHealth(null));
  }, []);
  const platformOk = health?.checks?.database?.status === 'ok';

  return (
    <DashboardShell>
      <div className="max-w-5xl">
        <PageHeader eyebrow="Help" title="Help and support" lede="How to do the common things, and how to reach a person at AIC." />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
          <section>
            <h2 className="mb-3 text-base font-semibold text-[#0e1b2c]">How do I…</h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 lift-children">
              {TASKS.map((t) => (
                <li key={t.href} className="contents">
                  <Link href={t.href} className="group flex items-start justify-between gap-3 rounded-xl border border-[#dde2e8] bg-white p-4 hover:border-[#a8772a]">
                    <span>
                      <span className="block text-sm font-semibold text-[#0e1b2c]">{t.title}</span>
                      <span className="mt-1 block text-[13px] leading-relaxed text-[#5e6b7b]">{t.body}</span>
                    </span>
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[#9aa5b1] group-hover:text-[#8a6a1f]" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <aside className="space-y-3">
            <SectionCard>
              <div className="flex items-center gap-2 text-sm font-semibold text-[#0e1b2c]">
                <MessageSquare className="h-4 w-4 text-[#8a6a1f]" /> Talk to your assessor
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-[#5e6b7b]">
                Questions about your assessment go through Correspondence, so the answer stays on your record.
              </p>
              <Link href="/correspondence" className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-full bg-[#0e1b2c] text-sm font-medium text-white hover:bg-[#22344a]">
                Open correspondence
              </Link>
            </SectionCard>

            <SectionCard>
              <div className="text-sm font-semibold text-[#0e1b2c]">Platform status</div>
              <p className="mt-2 flex items-center gap-2 text-[13px] text-[#5e6b7b]">
                <span className={`h-2 w-2 rounded-full ${health ? (platformOk ? 'bg-[#2f7d4f]' : 'bg-[#b42318]') : 'bg-[#c5cdd6]'}`} />
                {health ? (platformOk ? 'Working normally.' : 'Some parts are not working. AIC has been alerted.') : 'Checking…'}
              </p>
            </SectionCard>

            <SectionCard>
              <div className="flex items-center gap-2 text-sm font-semibold text-[#0e1b2c]">
                <ShieldAlert className="h-4 w-4 text-[#8a6a1f]" /> Found a security problem?
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-[#5e6b7b]">
                Email <a className="font-medium text-[#8a6a1f] underline-offset-2 hover:underline" href="mailto:security@aiccertified.cloud">security@aiccertified.cloud</a>. Please don’t put details in Correspondence.
              </p>
            </SectionCard>
          </aside>
        </div>
      </div>
    </DashboardShell>
  );
}
