import { describe, it, expect, vi, afterEach } from 'vitest';
import { zendesk } from '@/lib/connectors/providers/zendesk';
import { CONNECTOR_BY_KEY } from '@/lib/connectors/catalog';

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
const CREDS = { subdomain: 'acme', email: 'admin@acme.co', token: 't' };
const zd = (id: number, name: string, role: string, extra: Record<string, unknown> = {}) => ({
  id, name, email: `${name.toLowerCase()}@acme.co`, role, active: true, suspended: false,
  two_factor_auth_enabled: true, last_login_at: '2026-10-01T00:00:00Z', created_at: '2025-01-01T00:00:00Z', ...extra,
});

afterEach(() => vi.unstubAllGlobals());

describe('zendesk connector', () => {
  it('runs every check', async () => {
    const f = fakeFetch({
      '/api/v2/users?page[after]=xyz': { users: [zd(4, 'Dan', 'agent', { last_login_at: '2026-01-01T00:00:00Z' }), zd(5, 'Eve', 'agent', { suspended: true, two_factor_auth_enabled: false })], meta: { has_more: false }, links: { next: null } },
      '/api/v2/users': { users: [zd(1, 'Ann', 'admin'), zd(2, 'Ben', 'admin', { two_factor_auth_enabled: false }), zd(3, 'Cat', 'agent', { last_login_at: null })], meta: { has_more: true }, links: { next: 'https://acme.zendesk.com/api/v2/users?page[after]=xyz' } },
    });
    vi.stubGlobal('fetch', f);
    const out = await zendesk.run(CREDS, { now: NOW });
    expect(new Set(out.results.map((r) => r.checkKey))).toEqual(new Set(CONNECTOR_BY_KEY.zendesk.checks.map((c) => c.key)));
    expect(out.results).toHaveLength(CONNECTOR_BY_KEY.zendesk.checks.length);
    const by = Object.fromEntries(out.results.map((r) => [r.checkKey, r]));
    expect(by['zendesk.agents_mfa'].status).toBe('fail');
    expect(by['zendesk.agents_mfa'].summary).toBe('1 agent or admin without two-factor sign-in: Ben.');
    expect(by['zendesk.admins_limited'].status).toBe('pass');
    expect(by['zendesk.stale_agents'].status).toBe('fail');
    expect(by['zendesk.stale_agents'].summary).toContain('Cat, Dan');
    expect(by['zendesk.stale_agents'].summary).not.toContain('Eve');
    expect(out.label).toBe('acme.zendesk.com');
    expect(String(f.mock.calls[0][0])).toContain('https://acme.zendesk.com/api/v2/users?role[]=admin&role[]=agent&page[size]=100');
    expect(new Headers(((f.mock.calls[0] as unknown[])[1] as RequestInit | undefined)?.headers).get('authorization')).toBe(`Basic ${Buffer.from('admin@acme.co/token:t').toString('base64')}`);
  });

  it('says two-factor is unknown when Zendesk hides it', async () => {
    vi.stubGlobal('fetch', fakeFetch({
      '/api/v2/users': { users: [zd(1, 'Ann', 'admin', { two_factor_auth_enabled: undefined })], meta: { has_more: false } },
    }));
    const out = await zendesk.run({ ...CREDS, subdomain: 'https://acme.zendesk.com/' }, { now: NOW });
    const by = Object.fromEntries(out.results.map((r) => [r.checkKey, r]));
    expect(by['zendesk.agents_mfa'].status).toBe('unknown');
    expect(by['zendesk.agents_mfa'].summary).toContain('sign-in provider');
    expect(by['zendesk.admins_limited'].status).toBe('warn');
    expect(by['zendesk.stale_agents'].status).toBe('pass');
  });

  it('lists accounts', async () => {
    vi.stubGlobal('fetch', fakeFetch({ '/api/v2/users': { users: [zd(1, 'Ann', 'admin'), zd(2, 'Ben', 'agent', { suspended: true, last_login_at: null })], meta: { has_more: false } } }));
    const acc = await zendesk.accounts!(CREDS, { now: NOW });
    expect(acc).toEqual([
      { system: 'Zendesk', account: 'ann@acme.co', displayName: 'Ann', privilege: 'Admin', lastActiveAt: '2026-10-01T00:00:00Z', enabled: true },
      { system: 'Zendesk', account: 'ben@acme.co', displayName: 'Ben', privilege: 'Agent', lastActiveAt: null, enabled: false },
    ]);
  });

  it('says what is wrong with a bad token', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: "Couldn't authenticate you" }), { status: 401 })));
    await expect(zendesk.run(CREDS, { now: NOW })).rejects.toMatchObject({ status: 401, message: expect.stringContaining("Couldn't authenticate you") });
  });
});
