import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, orgPeople, and, eq } from '@aic/db';
import { orgCaller, guarded } from '@/lib/registers/caller';
import { isUuid } from '@/lib/policy-hash';
import { forgetLeavers } from '@/lib/registers/facts';
import { cleanPerson } from '@/lib/registers/people';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const c = await orgCaller({ manage: true });
  if ('error' in c) return c.error;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const v = cleanPerson((await request.json().catch(() => ({}))) as Record<string, unknown>);
  if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 });
  return guarded('016', async () => {
    const r = await getTenantDb(c.orgId).query((tx) => tx.update(orgPeople).set({ ...v.value, updatedAt: new Date() }).where(and(eq(orgPeople.id, id), eq(orgPeople.orgId, c.orgId))).returning({ id: orgPeople.id }));
    forgetLeavers(c.orgId);
    return r.length ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Not found' }, { status: 404 });
  });
}

export async function DELETE(_r: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const c = await orgCaller({ manage: true });
  if ('error' in c) return c.error;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return guarded('016', async () => {
    const r = await getTenantDb(c.orgId).query((tx) => tx.delete(orgPeople).where(and(eq(orgPeople.id, id), eq(orgPeople.orgId, c.orgId))).returning({ id: orgPeople.id }));
    forgetLeavers(c.orgId);
    return r.length ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Not found' }, { status: 404 });
  });
}
