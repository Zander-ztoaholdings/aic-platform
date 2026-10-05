import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, customFrameworks, customFrameworkRequirements, and, eq } from '@aic/db';
import { validateCustom } from '@/lib/frameworks/custom';
import { isUuid } from '@/lib/policy-hash';
import { frameworksCaller, NOT_READY, isMissingTable } from '@/lib/frameworks/caller';

type Ctx = { params: Promise<{ id: string }> };

/** Replace an organisation's own framework: its name, description and every requirement. */
export async function PUT(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const c = await frameworksCaller({ manage: true });
  if ('error' in c) return c.error;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const v = validateCustom(await request.json().catch(() => null));
  if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 });
  try {
    const found = await getTenantDb(c.orgId).query(async (tx) => {
      const [f] = await tx.update(customFrameworks)
        .set({ name: v.value.name, description: v.value.description, updatedAt: new Date() })
        .where(and(eq(customFrameworks.id, id), eq(customFrameworks.orgId, c.orgId)))
        .returning({ id: customFrameworks.id });
      if (!f) return false;
      await tx.delete(customFrameworkRequirements).where(eq(customFrameworkRequirements.frameworkId, id));
      await tx.insert(customFrameworkRequirements).values(v.value.requirements.map((r, i) => ({
        frameworkId: id, orgId: c.orgId, position: i + 1, ref: r.id, title: r.title, controls: r.controls,
      })));
      return true;
    });
    if (!found) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (isMissingTable(e)) return NOT_READY();
    throw e;
  }
}

/** Remove an organisation's own framework. Evidence is untouched: it belongs to the common controls. */
export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const c = await frameworksCaller({ manage: true });
  if ('error' in c) return c.error;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const rows = await getTenantDb(c.orgId).query((tx) =>
      tx.delete(customFrameworks).where(and(eq(customFrameworks.id, id), eq(customFrameworks.orgId, c.orgId))).returning({ id: customFrameworks.id }));
    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (isMissingTable(e)) return NOT_READY();
    throw e;
  }
}
