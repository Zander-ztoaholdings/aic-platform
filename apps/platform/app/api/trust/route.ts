import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, getSystemDb, trustPages, eq, and, ne } from '@aic/db';
import { policyCaller } from '@/lib/policies';
import { gatherOrgFacts } from '@/lib/org-facts';
import { computeControls } from '@/lib/controls-data';
import { buildTrustView, normaliseSections, suggestSlug, SLUG_RE, RESERVED_SLUGS, SECTION_KEYS, SECTION_LABELS } from '@/lib/trust';

export const dynamic = 'force-dynamic';

/** The organisation's Trust page settings, and a preview of what the public sees. */
export async function GET() {
  const c = await policyCaller();
  if ('error' in c) return c.error;
  const [row] = await getTenantDb(c.orgId).query((tx) => tx.select().from(trustPages).where(eq(trustPages.orgId, c.orgId)).limit(1));
  const facts = await gatherOrgFacts(c.orgId);
  if (!facts) return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });
  const sections = normaliseSections(row?.sections);
  const controls = await computeControls(c.orgId);
  const preview = buildTrustView(facts, sections, controls, {
    intro: row?.intro ?? null, contactEmail: row?.contactEmail ?? null, updatedAt: (row?.updatedAt ?? new Date()).toString(),
  });
  return NextResponse.json({
    canManage: c.canManage,
    page: { enabled: row?.enabled ?? false, slug: row?.slug ?? suggestSlug(facts.org.legalName || facts.org.name), intro: row?.intro ?? '', contactEmail: row?.contactEmail ?? '', sections, exists: !!row },
    sectionKeys: SECTION_KEYS, sectionLabels: SECTION_LABELS,
    preview,
  });
}

/** Save the Trust page (organisation admins). */
export async function PUT(request: NextRequest) {
  const c = await policyCaller({ manage: true });
  if ('error' in c) return c.error;
  const b = (await request.json().catch(() => ({}))) as { enabled?: unknown; slug?: unknown; intro?: unknown; contactEmail?: unknown; sections?: unknown };
  const slug = typeof b.slug === 'string' ? b.slug.trim().toLowerCase() : '';
  if (!SLUG_RE.test(slug) || RESERVED_SLUGS.has(slug)) {
    return NextResponse.json({ error: 'The address can use lower-case letters, numbers and hyphens, 3 to 80 characters.' }, { status: 400 });
  }
  const intro = typeof b.intro === 'string' ? b.intro.trim().slice(0, 1200) : '';
  const contactEmail = typeof b.contactEmail === 'string' ? b.contactEmail.trim().slice(0, 255) : '';
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return NextResponse.json({ error: 'The contact email does not look right.' }, { status: 400 });
  }
  const [taken] = await getSystemDb().select({ orgId: trustPages.orgId }).from(trustPages).where(and(eq(trustPages.slug, slug), ne(trustPages.orgId, c.orgId))).limit(1);
  if (taken) return NextResponse.json({ error: 'That address is already in use. Choose another.' }, { status: 409 });

  const values = {
    orgId: c.orgId, slug, enabled: b.enabled === true, intro: intro || null, contactEmail: contactEmail || null,
    sections: normaliseSections(b.sections), updatedBy: c.userId, updatedAt: new Date(),
  };
  await getTenantDb(c.orgId).query((tx) =>
    tx.insert(trustPages).values(values).onConflictDoUpdate({ target: trustPages.orgId, set: { ...values } })
  );
  return NextResponse.json({ ok: true, slug, enabled: values.enabled });
}
