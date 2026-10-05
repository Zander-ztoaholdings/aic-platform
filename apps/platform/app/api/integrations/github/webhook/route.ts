import { NextRequest, NextResponse } from 'next/server';
import { getSystemDb, integrations, integrationChecks, eq, and } from '@aic/db';
import { validGitHubSignature, SYNC_EVENTS, debounce } from '@/lib/integrations/webhook';
import { syncOrg } from '@/lib/integrations/sync';

/**
 * GitHub App webhooks. Lets a change on GitHub show up within a minute
 * instead of at the next nightly run: a branch rule switched off, a pull
 * request merged without review, a new leaked-secret alert, or the App being
 * uninstalled.
 *
 * Public in the middleware (GitHub has no session); every request must carry
 * a valid X-Hub-Signature-256 made with GITHUB_WEBHOOK_SECRET, or it is
 * refused before anything is read.
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!validGitHubSignature(raw, request.headers.get('x-hub-signature-256'), process.env.GITHUB_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }
  const event = request.headers.get('x-github-event') ?? '';
  let body: { action?: string; installation?: { id?: number } };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Bad payload' }, { status: 400 });
  }
  const installationId = body.installation?.id ? String(body.installation.id) : null;
  if (!installationId) return NextResponse.json({ ok: true, ignored: 'no installation' });

  const db = getSystemDb();
  const rows = await db
    .select({ id: integrations.id, orgId: integrations.orgId })
    .from(integrations)
    .where(and(eq(integrations.provider, 'github'), eq(integrations.externalId, installationId)));
  if (rows.length === 0) return NextResponse.json({ ok: true, ignored: 'unknown installation' });

  if (event === 'installation' && (body.action === 'deleted' || body.action === 'suspend')) {
    for (const r of rows) {
      await db.update(integrations)
        .set({ status: 'disconnected', lastError: body.action === 'deleted' ? 'The AIC GitHub App was uninstalled on GitHub.' : 'The AIC GitHub App was suspended on GitHub.', updatedAt: new Date() })
        .where(eq(integrations.id, r.id));
      await db.delete(integrationChecks).where(eq(integrationChecks.integrationId, r.id));
    }
    return NextResponse.json({ ok: true, disconnected: rows.length });
  }

  if (SYNC_EVENTS.has(event) || (event === 'installation' && body.action === 'unsuspend')) {
    if (event === 'installation') {
      for (const r of rows) await db.update(integrations).set({ status: 'pending', lastError: null }).where(eq(integrations.id, r.id));
    }
    for (const r of rows) debounce(r.orgId, () => { void syncOrg(r.orgId, 'AIC GitHub webhook').catch((e) => console.error('[WEBHOOK] sync failed:', e)); });
    return NextResponse.json({ ok: true, queued: rows.length });
  }
  return NextResponse.json({ ok: true, ignored: event });
}
