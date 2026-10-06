import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getSystemDb, trustPages, eq, and } from '@aic/db';
import { gatherOrgFacts } from '@/lib/org-facts';
import { computeControls } from '@/lib/controls-data';
import { buildTrustView, normaliseSections, SLUG_RE } from '@/lib/trust';
import { TrustView } from '@/app/components/TrustView';

export const dynamic = 'force-dynamic';

async function load(slug: string) {
  if (!SLUG_RE.test(slug)) return null;
  const [row] = await getSystemDb().select().from(trustPages).where(and(eq(trustPages.slug, slug), eq(trustPages.enabled, true))).limit(1);
  if (!row) return null;
  const facts = await gatherOrgFacts(row.orgId);
  if (!facts) return null;
  const sections = normaliseSections(row.sections);
  const tracked = sections.frameworks ? await computeControls(row.orgId) : { frameworks: [], controls: [] };
  return buildTrustView(facts, sections, tracked, { intro: row.intro, contactEmail: row.contactEmail, updatedAt: new Date().toISOString() });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const v = await load(slug);
  return v ? { title: `${v.name} | Trust page | AIC`, description: `How ${v.name} governs its use of AI, from its AIC record.` } : { title: 'Trust page | AIC' };
}

/**
 * An organisation's public Trust page. Read live on every request, so a
 * revoked badge or a suspended certificate stops showing as valid at once.
 */
export default async function PublicTrustPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const v = await load(slug);
  if (!v) notFound();
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fbfcfd_0%,#f3f5f8_100%)] text-[#0e1b2c]">
      <header className="border-b border-[#0a1728]/[0.06] bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-5">
          <span className="font-serif text-[19px] font-bold tracking-tight">AIC<span className="text-[#a8772a]">.</span></span>
          <span className="text-[12px] text-[#5e6b7b]">Trust page</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 pt-10 pb-20 page-enter">
        <div className="mb-3 text-[13px] font-medium text-[#8a6a1f]">How this organisation governs its AI</div>
        <h1 className="font-serif text-[32px] md:text-[40px] leading-tight font-semibold">{v.name}</h1>
        <p className="mt-2 mb-8 text-[13px] text-[#5e6b7b]">Read live from the organisation&apos;s record with AI Integrity Certification. Each item says who stands behind it.</p>
        <TrustView v={v} />
        <footer className="mt-12 border-t border-[#dde2e8] pt-5 text-[12px] leading-relaxed text-[#8a95a3]">
          AIC publishes this page at the organisation&apos;s request. &ldquo;Issued by AIC&rdquo; items are AIC&apos;s own records and are withdrawn here the moment AIC suspends or revokes them. &ldquo;Observed by AIC&rdquo; items come from read-only connections to the organisation&apos;s systems. &ldquo;Declared&rdquo; items are the organisation&apos;s own statements. <a href="https://aiccertified.cloud" className="text-[#8a6a1f] hover:underline underline-offset-2">aiccertified.cloud</a>
        </footer>
      </main>
    </div>
  );
}
