import { redirect } from 'next/navigation';
import { auth } from '@aic/auth';
import { homeFor, type WorkspaceUser } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

/**
 * The bare domain. Sends each person to their own home.
 *
 * This used to render a "Certification Overview" built on /api/dashboard's
 * invented baselines — an empathy score of 75 and a correction score of 90
 * for an organisation with no data at all — and, because the client nav's
 * "Continuity Record" pointed at "/", it was the first thing every client saw.
 * The Continuity Record itself lives at /dashboard and reads real data.
 */
export default async function RootPage() {
  const session = await auth();
  redirect(homeFor((session?.user as WorkspaceUser | undefined) ?? null));
}
