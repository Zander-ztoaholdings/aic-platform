import { NextResponse } from 'next/server';
import { orgCaller } from '@/lib/integrations/http';
import { canManageEstate } from '@/lib/roles';
import { listProjects, createProject, cleanProject, orgMembers } from '@/lib/projects';

const missing = (e: unknown) => ((e as { code?: string }).code ?? (e as { cause?: { code?: string } }).cause?.code) === '42P01';

/** Every project, and the people who can be put on one. */
export async function GET() {
  const c = await orgCaller();
  if ('error' in c) return c.error;
  try {
    const [list, people] = await Promise.all([listProjects(c.orgId), orgMembers(c.orgId)]);
    return NextResponse.json({ projects: list, people, canEdit: canManageEstate(c.role) });
  } catch (e) {
    if (missing(e)) return NextResponse.json({ projects: [], people: [], canEdit: false, notReady: true });
    throw e;
  }
}

export async function POST(request: Request) {
  const c = await orgCaller();
  if ('error' in c) return c.error;
  if (!canManageEstate(c.role)) return NextResponse.json({ error: 'Only members of the organisation can start a project.' }, { status: 403 });
  const v = cleanProject((await request.json().catch(() => ({}))) as Record<string, unknown>, true);
  if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 });
  try {
    const id = await createProject(c.orgId, c.userId, v.value as { name: string });
    return NextResponse.json({ id });
  } catch (e) {
    if (missing(e)) return NextResponse.json({ error: 'Projects are not switched on for this server yet (migration 021).' }, { status: 503 });
    throw e;
  }
}
