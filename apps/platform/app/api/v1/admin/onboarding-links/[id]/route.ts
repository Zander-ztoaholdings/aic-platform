import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@aic/auth';
import { getSystemDb, clientOnboardingLinks, eq } from '@aic/db';
import { hasCapability } from '@/lib/rbac';
import { recordAdminAction } from '@/lib/admin';
import { isUuid } from '@/lib/policy-hash';

export const dynamic = 'force-dynamic';

/** Withdraws a link so it can no longer be used. */
export async function DELETE(_r: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const u = session?.user as { id?: string; isSuperAdmin?: boolean } | undefined;
  if (!u?.id) return NextResponse.json({ error: 'Sign in.' }, { status: 401 });
  if (!u.isSuperAdmin && !(await hasCapability(u.id, 'view_all_orgs'))) return NextResponse.json({ error: 'AIC staff only.' }, { status: 403 });
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const [row] = await getSystemDb().update(clientOnboardingLinks).set({ revokedAt: new Date() }).where(eq(clientOnboardingLinks.id, id)).returning({ id: clientOnboardingLinks.id });
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await recordAdminAction({ actorId: u.id, orgId: null, targetType: 'ADMIN_ORG', targetId: null, previous: { onboardingLink: id }, next: { revoked: true }, reason: 'Withdrew a client onboarding link' }).catch(() => {});
  return NextResponse.json({ ok: true });
}
