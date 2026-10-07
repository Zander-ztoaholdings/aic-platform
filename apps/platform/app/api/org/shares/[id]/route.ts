import { NextResponse } from 'next/server';
import { orgCaller } from '@/lib/integrations/http';
import { canManageEstate } from '@/lib/roles';
import { withdrawShare } from '@/lib/record-shares';

/** Withdraw a share. The link stops working at once; its view log stays. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await orgCaller();
  if ('error' in c) return c.error;
  if (!canManageEstate(c.role)) return NextResponse.json({ error: 'Only members of the organisation can withdraw a share.' }, { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Which share?' }, { status: 400 });
  const ok = await withdrawShare(c.orgId, id, c.userId);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'That share is already withdrawn.' }, { status: 404 });
}
