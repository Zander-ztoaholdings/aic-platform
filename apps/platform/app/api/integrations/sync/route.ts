import { NextResponse } from 'next/server';
import { getTenantDb, integrations, eq } from '@aic/db';
import { orgCaller } from '@/lib/integrations/http';
import { syncOrg } from '@/lib/integrations/sync';

const MIN_GAP_MS = 2 * 60 * 1000;

/** "Check now". Any member may ask; at most once every two minutes per organisation. */
export async function POST() {
  const caller = await orgCaller();
  if ('error' in caller) return caller.error;

  const rows = await getTenantDb(caller.orgId).query((tx) =>
    tx.select({ lastSyncedAt: integrations.lastSyncedAt }).from(integrations).where(eq(integrations.orgId, caller.orgId))
  );
  if (rows.length === 0) return NextResponse.json({ error: 'Nothing is connected yet.' }, { status: 400 });
  const latest = Math.max(...rows.map((r) => (r.lastSyncedAt ? new Date(r.lastSyncedAt).getTime() : 0)));
  if (Date.now() - latest < MIN_GAP_MS) {
    return NextResponse.json({ error: 'Checked less than two minutes ago. Try again shortly.' }, { status: 429 });
  }
  const outcomes = await syncOrg(caller.orgId, caller.label);
  return NextResponse.json({ outcomes });
}
