import { redirect } from 'next/navigation';
import { auth } from '@aic/auth';
import { canUseStaffWorkspace, homeFor, type WorkspaceUser } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

/**
 * The staff workspace gate. Runs on the server before any /admin page renders.
 *
 * There was no gate here. Every /admin page is a client component that fetches
 * from capability-checked APIs, so a client who opened /admin/users got an
 * empty table rather than other people's data — but they still got the staff
 * console: its navigation, the names of AIC's internal tools, and a button
 * labelled "Execute New Audit". Refusing at the layout means the interface
 * itself is never sent to someone who may not use it.
 *
 * The APIs keep their own checks. This is the outer door, not a replacement
 * for the inner ones.
 */
export default async function StaffWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login?next=/admin');

  const user = session.user as WorkspaceUser;
  if (!canUseStaffWorkspace(user)) redirect(homeFor(user));

  return <>{children}</>;
}
