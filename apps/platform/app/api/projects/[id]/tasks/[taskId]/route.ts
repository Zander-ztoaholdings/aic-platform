import { NextResponse } from 'next/server';
import { orgCaller } from '@/lib/integrations/http';
import { canManageEstate } from '@/lib/roles';
import { updateTask, deleteTask, cleanTask } from '@/lib/projects';

type P = { params: Promise<{ id: string; taskId: string }> };
const ids = (a: string, b: string) => /^[0-9a-f-]{36}$/i.test(a) && /^[0-9a-f-]{36}$/i.test(b);

export async function PATCH(request: Request, { params }: P) {
  const c = await orgCaller();
  if ('error' in c) return c.error;
  if (!canManageEstate(c.role)) return NextResponse.json({ error: 'Only members of the organisation can change tasks.' }, { status: 403 });
  const { id, taskId } = await params;
  const v = cleanTask((await request.json().catch(() => ({}))) as Record<string, unknown>);
  if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 });
  return ids(id, taskId) && (await updateTask(c.orgId, id, taskId, v.value)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'No such task.' }, { status: 404 });
}

export async function DELETE(_r: Request, { params }: P) {
  const c = await orgCaller();
  if ('error' in c) return c.error;
  if (!canManageEstate(c.role)) return NextResponse.json({ error: 'Only members of the organisation can remove tasks.' }, { status: 403 });
  const { id, taskId } = await params;
  return ids(id, taskId) && (await deleteTask(c.orgId, id, taskId)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'No such task.' }, { status: 404 });
}
