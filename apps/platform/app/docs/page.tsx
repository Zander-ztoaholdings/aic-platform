import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Session } from 'next-auth';
import { getSession } from '../../lib/auth';
import DashboardShell from '../components/DashboardShell';
import { PageHeader } from '../components/ui/PageHeader';
import { DOCS, DOC_GROUPS } from '@/lib/docs';
import { DocsFrame } from './DocsFrame';

export const metadata = { title: 'Docs | AIC' };
export const dynamic = 'force-dynamic';

export default async function DocsIndex() {
  const session = (await getSession()) as Session | null;
  if (!session?.user) redirect('/login?next=/docs');
  return (
    <DashboardShell>
      <PageHeader title="Docs" lede="How the platform works, from set-up to recording decisions from your own systems. Each page describes what the platform does today." />
      <DocsFrame>
        <div className="space-y-10">
          {DOC_GROUPS.map((g) => (
            <section key={g} aria-label={g}>
              <h2 className="mb-3 text-[15px] font-semibold text-[#0e1b2c]">{g}</h2>
              <ul className="grid gap-px overflow-hidden rounded-xl border border-[#dde2e8] bg-[#dde2e8] md:grid-cols-2">
                {DOCS.filter((d) => d.group === g).map((d) => (
                  <li key={d.slug} className="bg-white md:[&:last-child:nth-child(odd)]:col-span-2">
                    <Link href={`/docs/${d.slug}`} className="group block h-full p-5 hover:bg-[#fbfcfd]">
                      <span className="block font-semibold text-[#0e1b2c] transition-colors group-hover:text-[#8a6114]">{d.title}</span>
                      <span className="mt-1 block text-sm leading-[1.6] text-[#5e6b7b]">{d.summary}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DocsFrame>
    </DashboardShell>
  );
}
