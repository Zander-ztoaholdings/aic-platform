import { NextRequest, NextResponse } from 'next/server';
import { auth, VIEW_AS_COOKIE, VIEW_AS_ROLES, isClientRole, serializeViewAs, type ViewAsRole } from '@aic/auth';
import { getSystemDb, users, organizations, hitlLogs, eq, asc } from '@aic/db';

/**
 * Start, list options for, and leave a super-admin preview ("view as").
 * Only a real super admin may start one; anyone may leave one.
 */

async function realSuperAdmin(): Promise<string | null> {
  const session = await auth();
  const id = session?.user?.id as string | undefined;
  if (!id) return null;
  const [u] = await getSystemDb().select({ s: users.isSuperAdmin, a: users.isActive }).from(users).where(eq(users.id, id)).limit(1);
  return u?.s && u.a !== false ? id : null;
}

const LABEL: Record<ViewAsRole, string> = {
  ORG_ADMIN: 'Organisation Admin',
  ORG_USER: 'Organisation User',
  AIC_AUDITOR: 'AIC Auditor',
};

export async function GET() {
  if (!(await realSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const orgs = await getSystemDb()
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .orderBy(asc(organizations.name))
    .limit(500);
  return NextResponse.json({
    roles: VIEW_AS_ROLES.map((r) => ({ role: r, label: LABEL[r], needsOrganisation: isClientRole(r) })),
    organisations: orgs,
  });
}

export async function POST(request: NextRequest) {
  const actor = await realSuperAdmin();
  if (!actor) return NextResponse.json({ error: 'Only a super admin can preview other roles.' }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { role?: string; orgId?: string };
  const role = body.role as ViewAsRole;
  if (!VIEW_AS_ROLES.includes(role)) return NextResponse.json({ error: 'Choose a role to preview.' }, { status: 400 });

  let orgId: string | null = null;
  let orgName: string | null = null;
  if (isClientRole(role)) {
    if (!body.orgId) return NextResponse.json({ error: 'Choose an organisation to preview as.' }, { status: 400 });
    const [org] = await getSystemDb().select({ id: organizations.id, name: organizations.name }).from(organizations).where(eq(organizations.id, body.orgId)).limit(1);
    if (!org) return NextResponse.json({ error: 'No such organisation.' }, { status: 404 });
    orgId = org.id;
    orgName = org.name;
  }

  // On the record: a super admin looking at a client's workspace through the
  // client's eyes is access to that client's data, and should be visible later.
  await getSystemDb().insert(hitlLogs).values({
    orgId,
    actorId: actor,
    targetType: 'VIEW_AS',
    targetId: orgId,
    previousValue: null,
    newValue: { role, orgName },
    overrideReason: 'Super-admin preview of another role',
  }).catch((e) => console.error('[VIEW-AS] could not record preview start:', e));

  const res = NextResponse.json({ ok: true, home: isClientRole(role) ? '/dashboard' : '/admin' });
  res.cookies.set(VIEW_AS_COOKIE, serializeViewAs({ role, orgId, orgName }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 2 * 60 * 60, // previews end by themselves after two hours
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true, home: '/admin' });
  res.cookies.set(VIEW_AS_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
