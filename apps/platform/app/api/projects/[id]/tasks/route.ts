import { NextResponse } from 'next/server';
import { orgCaller } from '@/lib/integrations/http';
import { canManageEstate } from '@/lib/roles';
import { addTask, cleanTask } from '@/lib/projects';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await orgCaller();
  if ('error' in c) return c.error;
  if (!canManageEstate(c.role)) return NextResponse.json({ error: 'Only members of the organisation can add tasks.' }, { status: 403 });
  const { id } = await params;
  const v = cleanTask((await request.json().catch(() => ({}))) as Record<string, unknown>, true);
  if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 });
  const taskId = /^[0-9a-f-]{36}$/i.test(id) ? await addTask(c.orgId, id, c.userId, v.value) : null;
  return taskId ? NextResponse.json({ id: taskId }) : NextResponse.json({ error: 'No such project.' }, { status: 404 });
}
