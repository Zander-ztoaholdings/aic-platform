import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { getSession } from '../../../../lib/auth';
import { observeEstate, readContinuity } from '../../../../lib/continuity-store';

/**
 * The organisation's continuity record.
 *
 * GET reads it back with the chain verified. POST takes a fresh observation.
 *
 * Session-scoped with no orgId parameter, same as /api/org/overview: an
 * endpoint that accepts one has to be right about authorisation every time
 * anyone touches it, and this one does not need to take that risk.
 */

export async function GET(request: Request) {
  try {
    const session = (await getSession()) as Session | null;
    const orgId = session?.user?.orgId as string | undefined;
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limit = Math.min(
      Math.max(Number(new URL(request.url).searchParams.get('limit') ?? 50) || 50, 1),
      500
    );

    return NextResponse.json(await readContinuity(orgId, limit));
  } catch (error) {
    console.error('[CONTINUITY] Read error:', (error as Error).message);
    return NextResponse.json({ error: 'Failed to read continuity record' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const session = (await getSession()) as Session | null;
    const orgId = session?.user?.orgId as string | undefined;
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Attributed to the person who triggered it, not to the observer. An
    // on-demand observation is a human act and the record should say so —
    // "AIC continuity observer" is reserved for the scheduled run, and
    // blurring the two would let a person's action hide behind a system label.
    const actor = (session?.user?.name as string) || (session?.user?.email as string) || 'Account holder';
    const result = await observeEstate(orgId, actor, (session?.user?.id as string) ?? null);

    if (!result) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[CONTINUITY] Observe error:', (error as Error).message);
    return NextResponse.json({ error: 'Failed to take observation' }, { status: 500 });
  }
}
