import { redirect } from 'next/navigation';
import { auth } from '@aic/auth';
import { resolveLanding, type WorkspaceUser } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

/**
 * The one place a fresh session is routed from.
 *
 * Credentials sign-in and both SSO providers land here, and this decides —
 * on the server, from the session rather than anything the browser sent —
 * whether the person belongs in the client workspace or the staff one, and
 * whether the page they were originally heading for is somewhere they may go.
 * It renders nothing; it only redirects.
 */
export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const { next } = await searchParams;
  redirect(resolveLanding(session.user as WorkspaceUser, next));
}
