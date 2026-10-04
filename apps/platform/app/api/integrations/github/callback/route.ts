import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, integrations } from '@aic/db';
import { orgCaller, logIntegrationChange } from '@/lib/integrations/http';
import { verifyState } from '@/lib/integrations/state';
import { getInstallation, GitHubError } from '@/lib/integrations/github';
import { syncOrg } from '@/lib/integrations/sync';
import { appUrl } from '@/lib/app-url';

/**
 * Where GitHub sends the person back after they install (or request) the App.
 *
 * The installation id in the URL is not trusted on its own: the signed state
 * must match the signed-in person's organisation, and AIC then reads the
 * installation as the App to confirm it exists and to learn whose account it
 * is on.
 */
export async function GET(request: NextRequest) {
  const back = (q: string) => NextResponse.redirect(new URL(`/integrations?${q}`, appUrl()));
  const caller = await orgCaller({ manage: true });
  if ('error' in caller) return back('error=permission');

  const params = request.nextUrl.searchParams;
  const state = verifyState(params.get('state'));
  if (!state || state.orgId !== caller.orgId || state.userId !== caller.userId) return back('error=state');

  if (params.get('setup_action') === 'request') return back('github=requested');

  const installationId = params.get('installation_id');
  if (!installationId || !/^\d+$/.test(installationId)) return back('error=installation');

  let account: string | null = null;
  try {
    const inst = await getInstallation(installationId);
    account = inst.account?.login ?? null;
  } catch (e) {
    return back(`error=${e instanceof GitHubError && e.status === 404 ? 'installation' : 'github'}`);
  }

  const db = getTenantDb(caller.orgId);
  const [row] = await db.query((tx) =>
    tx.insert(integrations)
      .values({
        orgId: caller.orgId, provider: 'github', mode: 'github_app', status: 'pending',
        externalId: installationId, accountLabel: account, connectedBy: caller.userId,
      })
      .onConflictDoUpdate({
        target: [integrations.orgId, integrations.provider],
        set: {
          mode: 'github_app', status: 'pending', externalId: installationId, accountLabel: account,
          connectedBy: caller.userId, lastError: null, updatedAt: new Date(),
        },
      })
      .returning({ id: integrations.id })
  );
  await logIntegrationChange({
    orgId: caller.orgId, actorId: caller.userId, integrationId: row?.id ?? null,
    previous: null, next: { provider: 'github', account, installationId }, reason: 'Connected GitHub',
  });

  // The first sync reads every repository and can take a while; the page
  // shows "checking" until it lands.
  void syncOrg(caller.orgId).catch((e) => console.error('[INTEGRATIONS] first GitHub sync failed:', e));
  return back('connected=github');
}
