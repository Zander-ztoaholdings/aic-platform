import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Session } from 'next-auth';
import { getSession } from '../../../lib/auth';
import DashboardShell from '../../components/DashboardShell';
import { DOCS, docBySlug } from '@/lib/docs';
import { DocsFrame, DocBlockView } from '../DocsFrame';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = docBySlug(slug);
  return { title: d ? `${d.title} | AIC docs` : 'Docs | AIC' };
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = (await getSession()) as Session | null;
  const { slug } = await params;
  if (!session?.user) redirect(`/login?next=/docs/${encodeURIComponent(slug)}`);
  const d = docBySlug(slug);
  if (!d) notFound();
  const next = DOCS[DOCS.indexOf(d) + 1];
  return (
    <DashboardShell>
      <DocsFrame active={d.slug}>
        <p className="text-sm text-[#5e6b7b]">{d.group}</p>
        <h1 className="mt-1 font-serif text-[30px] font-semibold leading-tight text-[#0e1b2c] md:text-[34px]">{d.title}</h1>
        <p className="mt-2 max-w-[62ch] text-[16px] leading-[1.65] text-[#5e6b7b]">{d.summary}</p>
        <div className="mt-8 space-y-6">
          {d.body.map((b, k) => <DocBlockView key={k} b={b} />)}
        </div>
        {next && (
          <div className="mt-14 border-t border-[#dde2e8] pt-6">
            <p className="text-[13px] text-[#5e6b7b]">Next</p>
            <Link href={`/docs/${next.slug}`} className="text-lg font-semibold text-[#0e1b2c] hover:text-[#8a6114]">{next.title}</Link>
          </div>
        )}
      </DocsFrame>
    </DashboardShell>
  );
}
