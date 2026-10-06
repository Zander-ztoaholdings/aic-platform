import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, getSystemDb, integrations, and, eq, ne } from '@aic/db';
import { orgCaller, logIntegrationChange } from '@/lib/integrations/http';
import { signState, verifyState } from '@/lib/integrations/state';
import { tenantToken, signInUrl, redeemSignIn, TENANT_PROOF } from '@/lib/integrations/microsoft';
import { syncOrg } from '@/lib/integrations/sync';
import { appUrl } from '@/lib/app-url';

export const dynamic = 'force-dynamic';

const TENANT_COOKIE = 'aic_ms_tenant';
const COOKIE_PATH = '/api/integrations/microsoft';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Microsoft returns here twice.
 *
 * First after admin consent, with the tenant in the address. That tenant is
 * not trusted: anyone can edit an address, and any tenant that has consented
 * to AIC's app (another client's) would pass a token check. AIC checks the
 * consent took, then sends the administrator to sign in at that tenant's own
 * sign-in page.
 *
 * Then after that sign-in, with a code. AIC redeems it and reads the tenant
 * from the ID token Microsoft returns. Only if it is the same tenant, the
 * person is a member there rather than a guest, and no other AIC organisation
 * already holds that tenant, is the connection saved, marked as proved.
 */
export async function GET(request: NextRequest) {
  const redirectUri = `${appUrl()}/api/integrations/microsoft/callback`;
  const back = (q: string) => {
    const res = NextResponse.redirect(new URL(`/integrations?${q}`, appUrl()));
    res.cookies.delete({ name: TENANT_COOKIE, path: COOKIE_PATH });
    return res;
  };
  const caller = await orgCaller({ manage: true });
  if ('error' in caller) return back('error=permission');

  const p = request.nextUrl.searchParams;
  const state = verifyState(p.get('state'));
  if (!state || state.orgId !== caller.orgId || state.userId !== caller.userId) return back('error=state');
  if (p.get('error')) return back('microsoft=declined');

  // Step 1: back from consent.
  const code = p.get('code');
  if (!code) {
    const tenant = (p.get('tenant') ?? '').toLowerCase();
    if (!UUID.test(tenant)) return back('error=microsoft');
    try {
      await tenantToken(tenant);
    } catch {
      return back('error=microsoft');
    }
    const res = NextResponse.redirect(signInUrl(tenant, signState(caller.orgId, caller.userId), redirectUri));
    res.cookies.set(TENANT_COOKIE, tenant, { httpOnly: true, secure: true, sameSite: 'lax', path: COOKIE_PATH, maxAge: 900 });
    return res;
  }

  // Step 2: back from sign-in.
  const tenant = (request.cookies.get(TENANT_COOKIE)?.value ?? '').toLowerCase();
  if (!UUID.test(tenant)) return back('error=state');
  const who = await redeemSignIn(tenant, code, redirectUri);
  if (!who || who.tid !== tenant || !who.homeTenant) return back('microsoft=wrongtenant');

  // One tenant, one AIC organisation: evidence from a tenant describes one company.
  const [elsewhere] = await getSystemDb()
    .select({ id: integrations.id })
    .from(integrations)
    .where(and(eq(integrations.provider, 'microsoft'), eq(integrations.externalId, tenant), ne(integrations.orgId, caller.orgId), ne(integrations.status, 'disconnected')))
    .limit(1);
  if (elsewhere) return back('microsoft=taken');

  const settings = { tenantProof: TENANT_PROOF, provedAt: new Date().toISOString() };
  const [row] = await getTenantDb(caller.orgId).query((tx) =>
    tx.insert(integrations)
      .values({ orgId: caller.orgId, provider: 'microsoft', mode: 'admin_consent', status: 'pending', externalId: tenant, accountLabel: 'Microsoft 365', connectedBy: caller.userId, settings })
      .onConflictDoUpdate({
        target: [integrations.orgId, integrations.provider],
        set: { mode: 'admin_consent', status: 'pending', externalId: tenant, connectedBy: caller.userId, lastError: null, settings, updatedAt: new Date() },
      })
      .returning({ id: integrations.id })
  );
  await logIntegrationChange({
    orgId: caller.orgId, actorId: caller.userId, integrationId: row?.id ?? null,
    previous: null, next: { provider: 'microsoft', tenant, proof: TENANT_PROOF }, reason: 'Connected Microsoft 365 (tenant proved by an administrator signing in)',
  });
  void syncOrg(caller.orgId).catch((e) => console.error('[INTEGRATIONS] first Microsoft sync failed:', e));
  return back('connected=microsoft');
}
