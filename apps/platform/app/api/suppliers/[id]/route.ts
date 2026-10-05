import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, suppliers, and, eq } from '@aic/db';
import { orgCaller, guarded } from '@/lib/registers/caller';
import { isUuid } from '@/lib/policy-hash';
import { cleanSupplier } from '@/lib/registers/suppliers';

type Ctx = { params: Promise<{ id: string }> };

/** Update a supplier, or mark it offboarded ({ status: 'offboarded' }). */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const c = await orgCaller({ manage: true });
  if ('error' in c) return c.error;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  return guarded('016', async () => {
    const db = getTenantDb(c.orgId);
    if (b.status === 'offboarded' || b.status === 'active') {
      const r = await db.query((tx) => tx.update(suppliers).set({ status: b.status as string, updatedAt: new Date() }).where(and(eq(suppliers.id, id), eq(suppliers.orgId, c.orgId))).returning({ id: suppliers.id }));
      return r.length ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const v = cleanSupplier(b);
    if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 });
    const r = await db.query((tx) => tx.update(suppliers).set({ ...v.value, updatedAt: new Date() }).where(and(eq(suppliers.id, id), eq(suppliers.orgId, c.orgId))).returning({ id: suppliers.id }));
    return r.length ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Not found' }, { status: 404 });
  });
}
