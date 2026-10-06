import { describe, it, expect, vi, beforeEach } from 'vitest';

const TENANT = '11111111-2222-4333-8444-555555555555';
const OTHER = '99999999-2222-4333-8444-555555555555';
const idToken = (claims: object) => `x.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.y`;

const saved: unknown[] = [];
let elsewhere: unknown[] = [];
vi.mock('@aic/db', () => {
  const chain = { from: () => chain, where: () => chain, limit: async () => elsewhere };
  return {
    getSystemDb: () => ({ select: () => chain }),
    getTenantDb: () => ({ query: async (fn: (tx: unknown) => unknown) => fn({ insert: () => ({ values: (v: unknown) => { saved.push(v); return { onConflictDoUpdate: () => ({ returning: async () => [{ id: 'row' }] }) }; } }) }) }),
    integrations: {}, and: () => null, eq: () => null, ne: () => null,
  };
});
vi.mock('@/lib/integrations/http', () => ({ orgCaller: async () => ({ orgId: 'org-a', userId: 'user-a' }), logIntegrationChange: async () => {} }));
vi.mock('@/lib/integrations/sync', () => ({ syncOrg: async () => {} }));
vi.mock('@/lib/app-url', () => ({ appUrl: () => 'https://app.test' }));
vi.mock('@/lib/integrations/state', () => ({ signState: () => 'st', verifyState: () => ({ orgId: 'org-a', userId: 'user-a' }) }));

let signedInAs: object | null = null;
vi.stubGlobal('fetch', async (url: string) => {
  if (String(url).includes('/token')) {
    if (signedInAs === null) return new Response(JSON.stringify({ access_token: 't' }), { status: 200 });
    return new Response(JSON.stringify({ id_token: idToken(signedInAs) }), { status: 200 });
  }
  return new Response('', { status: 404 });
});

const { tenantProven, readIdToken } = await import('@/lib/integrations/microsoft');
const { GET } = await import('@/app/api/integrations/microsoft/callback/route');
const { NextRequest } = await import('next/server');

const req = (q: string, cookie?: string) => new NextRequest(`https://app.test/api/integrations/microsoft/callback?${q}`, { headers: cookie ? { cookie } : {} });

describe('Microsoft 365: the tenant is proved, not taken from the address', () => {
  beforeEach(() => { saved.length = 0; elsewhere = []; signedInAs = null; });

  it('only a connection marked as proved is read', () => {
    expect(tenantProven({ tenantProof: 'sign_in' })).toBe(true);
    expect(tenantProven({})).toBe(false);
    expect(tenantProven(null)).toBe(false);
  });

  it('reads the tenant and guest status from the ID token', () => {
    expect(readIdToken(idToken({ tid: TENANT.toUpperCase() }))).toEqual({ tid: TENANT, homeTenant: true });
    expect(readIdToken(idToken({ tid: TENANT, iss: 'https://login/x', idp: 'https://sts.windows.net/other/' }))?.homeTenant).toBe(false);
    expect(readIdToken(undefined)).toBeNull();
  });

  it('after consent, sends the administrator to sign in and saves nothing yet', async () => {
    const r = await GET(req(`state=st&tenant=${TENANT}`));
    expect(r.headers.get('location')).toContain(`/${TENANT}/oauth2/v2.0/authorize`);
    expect(r.headers.get('set-cookie')).toContain(`aic_ms_tenant=${TENANT}`);
    expect(saved).toHaveLength(0);
  });

  it('refuses a sign-in from a different tenant than the one consented', async () => {
    signedInAs = { tid: OTHER };
    const r = await GET(req('state=st&code=c', `aic_ms_tenant=${TENANT}`));
    expect(r.headers.get('location')).toContain('microsoft=wrongtenant');
    expect(saved).toHaveLength(0);
  });

  it('refuses a guest', async () => {
    signedInAs = { tid: TENANT, iss: 'https://login/x', idp: 'https://sts.windows.net/guest-home/' };
    expect((await GET(req('state=st&code=c', `aic_ms_tenant=${TENANT}`))).headers.get('location')).toContain('microsoft=wrongtenant');
  });

  it('refuses a tenant another AIC organisation already holds', async () => {
    signedInAs = { tid: TENANT };
    elsewhere = [{ id: 'x' }];
    expect((await GET(req('state=st&code=c', `aic_ms_tenant=${TENANT}`))).headers.get('location')).toContain('microsoft=taken');
    expect(saved).toHaveLength(0);
  });

  it('saves a proved connection when a member of that tenant signs in', async () => {
    signedInAs = { tid: TENANT };
    const r = await GET(req('state=st&code=c', `aic_ms_tenant=${TENANT}`));
    expect(r.headers.get('location')).toContain('connected=microsoft');
    expect(saved[0]).toMatchObject({ externalId: TENANT, settings: { tenantProof: 'sign_in' } });
  });
});
