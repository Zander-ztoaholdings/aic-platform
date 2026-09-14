import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth';
import { buildOrgOverview } from '../../../../lib/org-overview';
import type { Session } from 'next-auth';

/**
 * The organisation's own AI overview.
 *
 * Session-scoped and nothing else: this returns the caller's organisation, not
 * an organisation named in the request. There is deliberately no `orgId` query
 * parameter — an endpoint that accepts one is an endpoint that has to be right
 * about authorisation every single time it is touched, and this one does not
 * need to take that risk. The insurer reads the narrower extract at
 * /api/insurance/risk-score, which authenticates separately.
 */
export async function GET() {
  try {
    const session = (await getSession()) as Session | null;
    const orgId = session?.user?.orgId as string | undefined;

    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const overview = await buildOrgOverview(orgId);
    if (!overview) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json(overview);
  } catch (error) {
    console.error('[OVERVIEW] Build error:', (error as Error).message);
    return NextResponse.json({ error: 'Failed to build overview' }, { status: 500 });
  }
}
