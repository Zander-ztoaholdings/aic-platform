import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateKeyPairSync } from 'crypto';
import { googleWorkspace } from '@/lib/connectors/providers/google_workspace';
import { CONNECTOR_BY_KEY } from '@/lib/connectors/catalog';

/** A fake fetch answering by URL path. Each connector test uses this shape. */
function fakeFetch(routes: Record<string, unknown>, headers: Record<string, Record<string, string>> = {}) {
  return vi.fn(async (url: string | URL) => {
    const u = new URL(String(url));
    const key = Object.keys(routes).find((k) => (u.pathname + u.search).startsWith(k) || u.pathname === k);
    if (!key) return new Response(JSON.stringify({ error: { message: `no route ${u.pathname}` } }), { status: 404 });
    return new Response(JSON.stringify(routes[key]), { status: 200, headers: headers[key] ?? {} });
  });
}

const NOW = new Date('2026-10-05T10:00:00Z');
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
const CREDS = { serviceAccount: JSON.stringify({ client_email: 'aic@p.iam.gserviceaccount.com', private_key: privateKey }), adminEmail: 'it@acme.co.za' };
const user = (email: string, o: Record<string, unknown> = {}) => ({ primaryEmail: email, name: { fullName: email.split('@')[0].toUpperCase() }, isAdmin: false, isDelegatedAdmin: false, isEnrolledIn2Sv: true, suspended: false, archived: false, lastLoginTime: '2026-10-01T00:00:00.000Z', creationTime: '2024-01-01T00:00:00.000Z', ...o });

const USERS_PATH = '/admin/directory/v1/users?customer=my_customer&projection=basic&maxResults=500';

afterEach(() => vi.unstubAllGlobals());

describe('google workspace connector', () => {
  it('runs every check across pages', async () => {
    const fetch = fakeFetch({
      '/token': { access_token: 'ya29.x' },
      [`${USERS_PATH}&pageToken=p2`]: { users: [user('dee@acme.co.za', { isEnrolledIn2Sv: false, lastLoginTime: '1970-01-01T00:00:00.000Z' }), user('gone@acme.co.za', { suspended: true, isEnrolledIn2Sv: false })] },
      [USERS_PATH]: { users: [user('it@acme.co.za', { isAdmin: true }), user('bo@acme.co.za', { lastLoginTime: '2026-01-01T00:00:00.000Z' })], nextPageToken: 'p2' },
    });
    vi.stubGlobal('fetch', fetch);
    const out = await googleWorkspace.run(CREDS, { now: NOW });
    const by = Object.fromEntries(out.results.map((r) => [r.checkKey, r]));
    expect(new Set(out.results.map((r) => r.checkKey))).toEqual(new Set(CONNECTOR_BY_KEY.google_workspace.checks.map((c) => c.key)));
    expect(out.results).toHaveLength(CONNECTOR_BY_KEY.google_workspace.checks.length);
    expect(by['google_workspace.mfa_enforced'].status).toBe('fail');
    expect(by['google_workspace.mfa_enforced'].summary).toContain('dee@acme.co.za');
    expect(by['google_workspace.mfa_enforced'].summary).not.toContain('gone@');
    expect(by['google_workspace.admins_limited'].status).toBe('warn');
    expect(by['google_workspace.stale_accounts'].status).toBe('fail');
    expect(by['google_workspace.stale_accounts'].summary).toContain('bo@acme.co.za');
    expect(by['google_workspace.stale_accounts'].summary).toContain('dee@acme.co.za');
    expect(out.label).toBe('acme.co.za');
    // The token request impersonates the admin.
    const tokenBody = new URLSearchParams(String((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    const claims = JSON.parse(Buffer.from(tokenBody.get('assertion')!.split('.')[1], 'base64url').toString());
    expect(claims.sub).toBe('it@acme.co.za');
  });

  it('lists accounts', async () => {
    vi.stubGlobal('fetch', fakeFetch({
      '/token': { access_token: 'ya29.x' },
      [USERS_PATH]: { users: [user('it@acme.co.za', { isAdmin: true }), user('helper@acme.co.za', { isDelegatedAdmin: true }), user('gone@acme.co.za', { suspended: true, lastLoginTime: '1970-01-01T00:00:00.000Z' })] },
    }));
    const acc = await googleWorkspace.accounts!(CREDS, { now: NOW });
    expect(acc.map((a) => a.privilege)).toEqual(['Super admin', 'Delegated admin', 'Member']);
    expect(acc[2]).toMatchObject({ system: 'Google Workspace', account: 'gone@acme.co.za', enabled: false, lastActiveAt: null, displayName: 'GONE' });
  });

  it('says what is wrong when delegation is not set up', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'unauthorized_client', error_description: 'Client is unauthorized to retrieve access tokens using this method.' }), { status: 401 })));
    await expect(googleWorkspace.run(CREDS, { now: NOW })).rejects.toMatchObject({ status: 401, message: expect.stringContaining('unauthorized to retrieve access tokens') });
  });
});
