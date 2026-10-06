import { NextResponse } from 'next/server';
import { auth } from '@aic/auth';
import { getSystemDb, connectorRuns, gte } from '@aic/db';
import { hasCapability } from '@/lib/rbac';
import { CONNECTORS } from '@/lib/connectors/catalog';
import { connectorHealth } from '@/lib/connectors/health';

export const dynamic = 'force-dynamic';

/** Connector health across every organisation, from the last 180 days of recorded runs. AIC staff only. */
export async function GET() {
  const session = await auth();
  const user = session?.user as { id?: string; isSuperAdmin?: boolean } | undefined;
  if (!user?.id) return NextResponse.json({ error: 'Sign in.' }, { status: 401 });
  if (!user.isSuperAdmin && !(await hasCapability(user.id, 'view_all_orgs'))) return NextResponse.json({ error: 'AIC staff only.' }, { status: 403 });
  try {
    const runs = await getSystemDb().select().from(connectorRuns).where(gte(connectorRuns.ranAt, new Date(Date.now() - 180 * 86_400_000)));
    const health = connectorHealth(runs, CONNECTORS.map((c) => ({ key: c.key, name: c.name, category: c.category })));
    return NextResponse.json({ connectors: health.map((h) => ({ ...h, verifiedInCatalogue: !!CONNECTORS.find((c) => c.key === h.key)?.verified })) });
  } catch (e) {
    const msg = (e as Error).message ?? '';
    if (/connector_runs/.test(msg)) return NextResponse.json({ error: 'Connector health needs migration 017. Run db/manual/run-017-in-platform-terminal.txt.' }, { status: 503 });
    throw e;
  }
}
