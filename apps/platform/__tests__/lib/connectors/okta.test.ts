import { describe, it, expect, vi, afterEach } from 'vitest';
import { okta } from '@/lib/connectors/providers/okta';

/** A fake fetch answering by URL path. Each connector test uses this shape. */
function fakeFetch(routes: Record<string, unknown>, headers: Record<string, Record<string, string>> = {}) {
  return vi.fn(async (url: string | URL) => {
    const u = new URL(String(url));
    const key = Object.keys(routes).find((k) => (u.pathname + u.search).startsWith(k) || u.pathname === k);
    if (!key) return new Response(JSON.stringify({ errorSummary: `no route ${u.pathname}` }), { status: 404 });
    return new Response(JSON.stringify(routes[key]), { status: 200, headers: headers[key] ?? {} });
  });
}

const NOW = new Date('2026-10-05T10:00:00Z');
const user = (id: string, login: string, lastLogin: string | null, created = '2025-01-01T00:00:00Z') => ({ id, status: 'ACTIVE', created, lastLogin, profile: { login, email: login, firstName: id.toUpperCase(), lastName: 'X' } });

afterEach(() => vi.unstubAllGlobals());

describe('okta connector', () => {
  it('runs every check', async () => {
    vi.stubGlobal('fetch', fakeFetch({
      '/api/v1/users?limit=200': [user('a', 'a@x.co', '2026-10-01T00:00:00Z'), user('b', 'b@x.co', '2026-01-01T00:00:00Z')],
      '/api/v1/policies?type=ACCESS_POLICY': [{ id: 'p1', name: 'Default', status: 'ACTIVE' }],
      '/api/v1/policies/p1/rules': [{ name: 'Catch-all', status: 'ACTIVE', actions: { appSignOn: { access: 'ALLOW', verificationMethod: { factorMode: '1FA' } } } }],
      '/api/v1/users/a/factors': [{ factorType: 'token:software:totp', status: 'ACTIVE' }],
      '/api/v1/users/b/factors': [],
      '/api/v1/users/a/roles': [{ type: 'SUPER_ADMIN' }],
      '/api/v1/users/b/roles': [],
    }));
    const out = await okta.run({ domain: 'acme.okta.com', token: 't' }, { now: NOW });
    const by = Object.fromEntries(out.results.map((r) => [r.checkKey, r]));
    expect(by['okta.mfa_enforced'].status).toBe('fail');
    expect(by['okta.users_mfa_enrolled'].status).toBe('fail');
    expect(by['okta.users_mfa_enrolled'].summary).toContain('B X');
    expect(by['okta.admins_limited'].status).toBe('warn');
    expect(by['okta.stale_accounts'].status).toBe('fail');
    expect(out.label).toBe('acme.okta.com');
  });

  it('lists accounts', async () => {
    vi.stubGlobal('fetch', fakeFetch({ '/api/v1/users?limit=200': [user('a', 'a@x.co', null), { ...user('c', 'c@x.co', null), status: 'SUSPENDED' }] }));
    const acc = await okta.accounts!({ domain: 'acme.okta.com', token: 't' }, { now: NOW });
    expect(acc).toHaveLength(2);
    expect(acc[1]).toMatchObject({ system: 'Okta', account: 'c@x.co', enabled: false });
  });

  it('says what is wrong with a bad token', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ errorSummary: 'Invalid token provided' }), { status: 401 })));
    await expect(okta.run({ domain: 'acme.okta.com', token: 'bad' }, { now: NOW })).rejects.toMatchObject({ status: 401, message: expect.stringContaining('Invalid token provided') });
  });
});
