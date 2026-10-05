import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, risks, and, eq } from '@aic/db';
import { orgCaller, guarded } from '@/lib/registers/caller';
import { validateRisk } from '@/lib/registers/risk';
import { COMMON_CONTROLS } from '@/lib/common-controls';
import { isUuid } from '@/lib/policy-hash';

type Ctx = { params: Promise<{ id: string }> };
const KNOWN = new Set(COMMON_CONTROLS.map((c) => c.key));

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const c = await orgCaller({ manage: true });
  if ('error' in c) return c.error;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const v = validateRisk(await request.json().catch(() => null), KNOWN);
  if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 });
  return guarded('016', async () => {
    const r = await getTenantDb(c.orgId).query((tx) => tx.update(risks).set({ ...v.value, updatedAt: new Date() }).where(and(eq(risks.id, id), eq(risks.orgId, c.orgId))).returning({ id: risks.id }));
    return r.length ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Not found' }, { status: 404 });
  });
}

/** Admins only: remove a risk entered by mistake. A risk that no longer applies is closed instead, so its history stays. */
export async function DELETE(_r: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const c = await orgCaller({ admin: true });
  if ('error' in c) return c.error;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return guarded('016', async () => {
    const r = await getTenantDb(c.orgId).query((tx) => tx.delete(risks).where(and(eq(risks.id, id), eq(risks.orgId, c.orgId))).returning({ id: risks.id }));
    return r.length ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Not found' }, { status: 404 });
  });
}
