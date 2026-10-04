import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { orgsToSync, syncOrg } from '@/lib/integrations/sync';

/**
 * The nightly sync for every organisation with a connected system.
 *
 * Called by a scheduled task on the server (Coolify → Scheduled tasks):
 *   curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3001/api/cron/integrations
 *
 * Public in the middleware because there is no session; it authenticates
 * itself against CRON_SECRET, and refuses everything if that is not set.
 */
export const maxDuration = 300;

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
  const orgs = await orgsToSync();
  const summary: { orgId: string; outcomes: unknown }[] = [];
  for (const orgId of orgs) {
    try {
      summary.push({ orgId, outcomes: await syncOrg(orgId, 'AIC nightly sync') });
    } catch (e) {
      summary.push({ orgId, outcomes: [{ status: 'error', error: (e as Error).message }] });
    }
  }
  return NextResponse.json({ organisations: orgs.length, summary });
}
