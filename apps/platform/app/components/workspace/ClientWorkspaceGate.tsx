import { redirect } from 'next/navigation';
import { auth } from '@aic/auth';
import { canUseClientWorkspace, homeFor, type WorkspaceUser } from '@/lib/workspace';

/**
 * Server-side gate for the client workspace, used as the layout of each client
 * route. The pages themselves are client components, and DashboardShell's
 * redirect runs only after the page's JavaScript has loaded; this refuses on
 * the server so the page is never sent to a session without an organisation.
 * The APIs keep their own checks.
 */
export default async function ClientWorkspaceGate({
  children,
  path,
}: {
  children: React.ReactNode;
  path: string;
}) {
  const session = await auth();
  if (!session?.user) redirect(`/login?next=${encodeURIComponent(path)}`);
  const user = session.user as WorkspaceUser;
  if (!canUseClientWorkspace(user)) redirect(homeFor(user));
  return <>{children}</>;
}
