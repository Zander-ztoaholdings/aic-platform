import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, integrations } from '@aic/db';
import { orgCaller, logIntegrationChange } from '@/lib/integrations/http';
import { verifyState } from '@/lib/integrations/state';
import { tenantToken } from '@/lib/integrations/microsoft';
import { syncOrg } from '@/lib/integrations/sync';
import { appUrl } from '@/lib/app-url';

/**
 * Where Microsoft sends the administrator back after the consent screen.
 *
 * The tenant id in the URL is not trusted on its own (Microsoft's own advice):
 * the signed state must match the signed-in person, and AIC then proves the
 * consent by obtaining a token for that tenant, which only works if consent
 * was actually granted.
 */
export async function GET(request: NextRequest) {
  const back = (q: string) => NextResponse.redirect(new URL(`/integrations?${q}`, appUrl()));
  const caller = await orgCaller({ manage: true });
  if ('error' in caller) return back('error=permission');

  const p = request.nextUrl.searchParams;
  const state = verifyState(p.get('state'));
  if (!state || state.orgId !== caller.orgId || state.userId !== caller.userId) return back('error=state');
  if (p.get('error')) return back('microsoft=declined');

  const tenant = p.get('tenant');
  if (!tenant || !/^[0-9a-f-]{36}$/i.test(tenant)) return back('error=microsoft');
  try {
    await tenantToken(tenant);
  } catch {
    return back('error=microsoft');
  }

  const [row] = await getTenantDb(caller.orgId).query((tx) =>
    tx.insert(integrations)
      .values({ orgId: caller.orgId, provider: 'microsoft', mode: 'admin_consent', status: 'pending', externalId: tenant, accountLabel: 'Microsoft 365', connectedBy: caller.userId })
      .onConflictDoUpdate({
        target: [integrations.orgId, integrations.provider],
        set: { mode: 'admin_consent', status: 'pending', externalId: tenant, connectedBy: caller.userId, lastError: null, updatedAt: new Date() },
      })
      .returning({ id: integrations.id })
  );
  await logIntegrationChange({
    orgId: caller.orgId, actorId: caller.userId, integrationId: row?.id ?? null,
    previous: null, next: { provider: 'microsoft', tenant }, reason: 'Connected Microsoft 365',
  });
  void syncOrg(caller.orgId).catch((e) => console.error('[INTEGRATIONS] first Microsoft sync failed:', e));
  return back('connected=microsoft');
}
