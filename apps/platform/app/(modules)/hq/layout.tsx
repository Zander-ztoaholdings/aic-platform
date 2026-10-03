import { redirect } from 'next/navigation';
import { auth } from '@aic/auth';
import { canUseHq, homeFor, type WorkspaceUser } from '@/lib/workspace';
import AdminShell from '@/app/(modules)/admin/components/AdminShell';

export const dynamic = 'force-dynamic';

/**
 * The HQ gate: revenue, people and HR, the CMS, company governance.
 *
 * Twenty-one pages under /hq rendered for any signed-in person, with no shell
 * and no check. HQ is AIC's own business, not assessment work, so it sits
 * behind the isSuperAdmin boolean alone — an auditor assesses clients, and has
 * no reason to read AIC's revenue or its HR records.
 */
export default async function HqLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login?next=/hq');

  const user = session.user as WorkspaceUser;
  if (!canUseHq(user)) redirect(homeFor(user));

  // HQ pages had no shell at all, so there was no way back out of them and
  // nothing to navigate with on a phone. They share the staff shell, whose
  // menu already lists HQ.
  return <AdminShell>{children}</AdminShell>;
}
