import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@aic/auth';
import { hasCapability } from '@/lib/rbac';
import { recordAdminAction } from '@/lib/admin';
import { isUuid } from '@/lib/policy-hash';
import { emailLink } from '@/lib/onboarding-links';

export const dynamic = 'force-dynamic';

/** Emails the link to its contact from AIC (again, if it was sent before). */
export async function POST(_r: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const u = session?.user as { id?: string; isSuperAdmin?: boolean } | undefined;
  if (!u?.id) return NextResponse.json({ error: 'Sign in.' }, { status: 401 });
  if (!u.isSuperAdmin && !(await hasCapability(u.id, 'view_all_orgs'))) return NextResponse.json({ error: 'AIC staff only.' }, { status: 403 });
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const out = await emailLink(id, u.id);
  if (!out.sent) return NextResponse.json({ error: out.reason }, { status: out.reason === 'Not found' ? 404 : 409 });
  await recordAdminAction({ actorId: u.id, orgId: null, targetType: 'ADMIN_ORG', targetId: null, previous: null, next: { onboardingLink: id, emailedTo: out.to }, reason: 'Emailed a client onboarding link' }).catch(() => {});
  return NextResponse.json(out);
}
