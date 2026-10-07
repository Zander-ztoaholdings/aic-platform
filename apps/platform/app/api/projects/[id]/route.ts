import { NextResponse } from 'next/server';
import { orgCaller } from '@/lib/integrations/http';
import { canManageEstate, canManageTeamAndKeys } from '@/lib/roles';
import { getProject, updateProject, deleteProject, cleanProject } from '@/lib/projects';

type P = { params: Promise<{ id: string }> };
const bad = (id: string) => !/^[0-9a-f-]{36}$/i.test(id);

export async function GET(_r: Request, { params }: P) {
  const c = await orgCaller();
  if ('error' in c) return c.error;
  const { id } = await params;
  if (bad(id)) return NextResponse.json({ error: 'No such project.' }, { status: 404 });
  const p = await getProject(c.orgId, id);
  if (!p) return NextResponse.json({ error: 'No such project.' }, { status: 404 });
  return NextResponse.json({ ...p, canEdit: canManageEstate(c.role), canDelete: canManageTeamAndKeys(c.role) });
}

/** Edit the project; members, frameworks and systems are replaced by the lists sent. */
export async function PATCH(request: Request, { params }: P) {
  const c = await orgCaller();
  if ('error' in c) return c.error;
  if (!canManageEstate(c.role)) return NextResponse.json({ error: 'Only members of the organisation can change a project.' }, { status: 403 });
  const { id } = await params;
  if (bad(id)) return NextResponse.json({ error: 'No such project.' }, { status: 404 });
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const v = cleanProject(b);
  if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 });
  const ok = await updateProject(c.orgId, id, b, v.value);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'No such project.' }, { status: 404 });
}

/** Administrators only. Tasks go with it; evidence and the record are untouched. */
export async function DELETE(_r: Request, { params }: P) {
  const c = await orgCaller();
  if ('error' in c) return c.error;
  if (!canManageTeamAndKeys(c.role)) return NextResponse.json({ error: 'Only an administrator can delete a project.' }, { status: 403 });
  const { id } = await params;
  if (bad(id)) return NextResponse.json({ error: 'No such project.' }, { status: 404 });
  return (await deleteProject(c.orgId, id)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'No such project.' }, { status: 404 });
}
