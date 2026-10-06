import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, suppliers, supplierReviews, supplierDocumentReads, integrations, eq, desc } from '@aic/db';
import { orgCaller, guarded } from '@/lib/registers/caller';
import { supplierState, supplierFlags, nextReview, KNOWN_SUPPLIERS, cleanSupplier, documentConcerns } from '@/lib/registers/suppliers';

export const dynamic = 'force-dynamic';

/** The supplier register: each supplier, its last review, what needs attention, and suppliers AIC can see but nobody has listed. */
export async function GET() {
  const c = await orgCaller();
  if ('error' in c) return c.error;
  return guarded('016', async () => {
    const { rows, revs, ints } = await getTenantDb(c.orgId).query(async (tx) => ({
      rows: await tx.select().from(suppliers).where(eq(suppliers.orgId, c.orgId)).orderBy(suppliers.name),
      revs: await tx.select().from(supplierReviews).where(eq(supplierReviews.orgId, c.orgId)).orderBy(desc(supplierReviews.reviewedAt)),
      ints: await tx.select({ provider: integrations.provider }).from(integrations).where(eq(integrations.orgId, c.orgId)),
    }));
    // Document reads arrive with migration 017; before it, suppliers simply have none.
    let docs: { supplierId: string; createdAt: Date; findings: unknown; fileName: string }[] = [];
    try {
      docs = await getTenantDb(c.orgId).query((tx) => tx.select({ supplierId: supplierDocumentReads.supplierId, createdAt: supplierDocumentReads.createdAt, findings: supplierDocumentReads.findings, fileName: supplierDocumentReads.fileName })
        .from(supplierDocumentReads).where(eq(supplierDocumentReads.orgId, c.orgId)).orderBy(desc(supplierDocumentReads.createdAt)));
    } catch { /* 017 not applied */ }
    const list = rows.map((s) => {
      const history = revs.filter((r) => r.supplierId === s.id);
      const last = history[0] ?? null;
      const mine = docs.filter((d) => d.supplierId === s.id);
      return {
        ...s, lastReview: last, reviews: history.slice(0, 5), state: supplierState({ nextReviewAt: s.nextReviewAt, lastOutcome: last?.outcome ?? null }),
        flags: [...supplierFlags(s), ...documentConcerns(mine)],
        documents: { count: mine.length, latest: mine[0] ? { fileName: mine[0].fileName, createdAt: mine[0].createdAt } : null },
      };
    });
    const listed = new Set(rows.map((r) => r.name.trim().toLowerCase()));
    const suggestions = [...new Set(ints.map((i) => i.provider))]
      .map((p) => KNOWN_SUPPLIERS[p]).filter((k) => k && !listed.has(k.name.toLowerCase()));
    return NextResponse.json({ suppliers: list, suggestions, canManage: c.canManage });
  });
}

export async function POST(request: NextRequest) {
  const c = await orgCaller({ manage: true });
  if ('error' in c) return c.error;
  const v = cleanSupplier((await request.json().catch(() => ({}))) as Record<string, unknown>);
  if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 });
  return guarded('016', async () => {
    const [row] = await getTenantDb(c.orgId).query((tx) =>
      tx.insert(suppliers).values({ orgId: c.orgId, ...v.value, nextReviewAt: nextReview(v.value.criticality, new Date(0)), createdBy: c.userId }).returning({ id: suppliers.id }));
    return NextResponse.json({ id: row.id }, { status: 201 });
  });
}
