import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { getSystemDb, estateSnapshots } from '@aic/db';
import { observeEstate } from '@/lib/continuity-store';

/**
 * The continuity observation, every five minutes, for every organisation that
 * has begun its record. An observation only writes to the record when
 * something changed, so a quiet five minutes costs one comparison and adds
 * nothing; a change lands in the hash chain within five minutes of happening
 * instead of waiting for the nightly run.
 *
 * Called by a scheduled task on the server (Coolify → Scheduled tasks,
 * frequency * / 5 * * * * without the spaces):
 *   curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3001/api/cron/observe
 *
 * Public in the middleware because there is no session; it authenticates
 * itself against CRON_SECRET, and refuses everything if that is not set.
 */
export const maxDuration = 240;

function authorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 24) return false;
  const given = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // Only organisations that began a record: starting it is their act, not the scheduler's.
  const begun = await getSystemDb().select({ orgId: estateSnapshots.orgId }).from(estateSnapshots);
  let changed = 0, failed = 0;
  for (const { orgId } of begun) {
    try {
      const r = await observeEstate(orgId);
      if (r && r.eventsWritten > 0) changed++;
    } catch (e) {
      failed++;
      console.error('[OBSERVE]', orgId, (e as Error).message);
    }
  }
  return NextResponse.json({ organisations: begun.length, changed, failed });
}
