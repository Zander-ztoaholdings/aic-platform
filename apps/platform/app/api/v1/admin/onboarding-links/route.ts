import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@aic/auth';
import { getSystemDb, clientOnboardingLinks, users, and, eq, inArray } from '@aic/db';
import { hasCapability } from '@/lib/rbac';
import { recordAdminAction } from '@/lib/admin';
import { appUrl } from '@/lib/app-url';
import { cleanLinkInput, listLinks, newToken, emailLink } from '@/lib/onboarding-links';

export const dynamic = 'force-dynamic';

async function staff() {
  const session = await auth();
  const u = session?.user as { id?: string; isSuperAdmin?: boolean } | undefined;
  if (!u?.id) return { error: NextResponse.json({ error: 'Sign in.' }, { status: 401 }) } as const;
  if (!u.isSuperAdmin && !(await hasCapability(u.id, 'view_all_orgs'))) return { error: NextResponse.json({ error: 'AIC staff only.' }, { status: 403 }) } as const;
  return { id: u.id } as const;
}

const notReady = () => NextResponse.json({ error: 'Client onboarding links need migration 018. Run db/manual/run-018-in-platform-terminal.txt.', notReady: true }, { status: 503 });
const missing = (e: unknown) => /client_onboarding_links|42P01/.test(`${(e as { code?: string }).code ?? ''} ${(e as Error).message ?? ''}`);

/** Every link, newest first, with the AIC staff who can be named as lead. */
export async function GET() {
  const s = await staff();
  if ('error' in s) return s.error;
  try {
    const [links, leads] = await Promise.all([
      listLinks(),
      getSystemDb().select({ id: users.id, name: users.name, role: users.role }).from(users)
        .where(and(inArray(users.role, ['AIC_AUDITOR', 'AIC_SUPER_ADMIN']), eq(users.isActive, true))).orderBy(users.name),
    ]);
    const base = appUrl();
    return NextResponse.json({ links: links.map((l) => ({ ...l, url: `${base}/join/${l.token}` })), leads });
  } catch (e) {
    if (missing(e)) return notReady();
    throw e;
  }
}

/** Creates a link for one client. */
export async function POST(request: NextRequest) {
  const s = await staff();
  if ('error' in s) return s.error;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const v = cleanLinkInput(body);
  if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 });
  const { days, ...rest } = v.value;
  try {
    const [row] = await getSystemDb().insert(clientOnboardingLinks).values({
      ...rest, token: newToken(), expiresAt: new Date(Date.now() + days * 86_400_000), createdBy: s.id,
    }).returning();
    await recordAdminAction({ actorId: s.id, orgId: null, targetType: 'ADMIN_ORG', targetId: null, previous: null, next: { onboardingLink: row.id, orgName: row.orgName, contactEmail: row.contactEmail }, reason: 'Created a client onboarding link' }).catch(() => {});
    // Sent by AIC from aiccertified.cloud, so the client gets it from a sender they can check.
    const emailed = body.email === true && row.contactEmail ? await emailLink(row.id, s.id) : null;
    return NextResponse.json({ id: row.id, url: `${appUrl()}/join/${row.token}`, emailed }, { status: 201 });
  } catch (e) {
    if (missing(e)) return notReady();
    throw e;
  }
}
