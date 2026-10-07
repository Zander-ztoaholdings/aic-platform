import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { getSession } from '@/lib/auth';
import { getTenantDb, estateSnapshots, eq } from '@aic/db';
import { observeEstate } from '@/lib/continuity-store';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * An observation as someone signs out, so whatever they changed in their
 * session is on the record when they leave rather than at the next scheduled
 * run. Any member may trigger it, because it records state rather than
 * changing anything; it is attributed to the observer, noting the sign-out,
 * and only for an organisation that has begun its record. At most once a
 * minute per organisation.
 */
export async function POST() {
  const session = (await getSession()) as Session | null;
  const orgId = session?.user?.orgId as string | undefined;
  if (!orgId) return NextResponse.json({ ok: false }, { status: 401 });
  if (!(await checkRateLimit(`checkpoint:${orgId}`, 1, 60_000)).allowed) return NextResponse.json({ ok: true, skipped: 'recent' });
  try {
    const [begun] = await getTenantDb(orgId).query((tx) => tx.select({ orgId: estateSnapshots.orgId }).from(estateSnapshots).where(eq(estateSnapshots.orgId, orgId)).limit(1));
    if (!begun) return NextResponse.json({ ok: true, skipped: 'no record' });
    const who = (session?.user?.name as string) || (session?.user?.email as string) || 'a member';
    await observeEstate(orgId, `AIC continuity observer, at sign-out of ${who}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[CHECKPOINT]', (e as Error).message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
