import { describe, it, expect, vi, afterEach } from 'vitest';
import { datadog } from '@/lib/connectors/providers/datadog';
import { CONNECTOR_BY_KEY } from '@/lib/connectors/catalog';

/** A fake fetch answering by URL path. Each connector test uses this shape. A route set to `fail(n)` answers with that status. */
const FAIL = Symbol('fail');
const fail = (status: number) => ({ [FAIL]: status });
function fakeFetch(routes: Record<string, unknown>, headers: Record<string, Record<string, string>> = {}) {
  return vi.fn(async (url: string | URL) => {
    const u = new URL(String(url));
    const key = Object.keys(routes).find((k) => (u.pathname + u.search).startsWith(k) || u.pathname === k);
    if (!key) return new Response(JSON.stringify({ errorSummary: `no route ${u.pathname}` }), { status: 404 });
    const v = routes[key] as Record<symbol, number> | null;
    if (v && typeof v === 'object' && FAIL in v) return new Response(JSON.stringify({ message: 'forbidden' }), { status: v[FAIL] });
    return new Response(JSON.stringify(routes[key]), { status: 200, headers: headers[key] ?? {} });
  });
}

const NOW = new Date('2026-10-05T10:00:00Z');
const CREDS = { site: 'datadoghq.eu', apiKey: 'k', appKey: 'a' };
const user = (id: string, email: string, status: string, roles: string[], created = '2025-01-01T00:00:00Z') =>
  ({ id, attributes: { email, name: id.toUpperCase(), status, disabled: status === 'Disabled', created_at: created }, relationships: { roles: { data: roles.map((r) => ({ id: r, type: 'roles' })) } } });
const USERS = { data: [
  user('a', 'a@x.co', 'Active', ['r-admin']), user('b', 'b@x.co', 'Active', ['r-std']),
  user('c', 'c@x.co', 'Pending', ['r-admin'], '2026-08-01T00:00:00Z'), user('d', 'd@x.co', 'Pending', [], '2026-10-01T00:00:00Z'),
  user('e', 'e@x.co', 'Disabled', ['r-admin']), user('f', 'f@x.co', 'Active', ['r-admin']),
], meta: { page: { total_count: 6 } } };
const ROLES = { data: [{ id: 'r-admin', attributes: { name: 'Datadog Admin Role' } }, { id: 'r-std', attributes: { name: 'Datadog Standard Role' } }] };

afterEach(() => vi.unstubAllGlobals());

describe('datadog connector', () => {
  it('runs every check', async () => {
    const f = fakeFetch({ '/api/v2/users': USERS, '/api/v2/roles': ROLES, '/api/v2/audit/events': { data: [{ id: 'ev' }] } });
    vi.stubGlobal('fetch', f);
    const out = await datadog.run(CREDS, { now: NOW });
    expect(String(f.mock.calls[0][0])).toContain('https://api.datadoghq.eu/api/v2/users');
    expect(new Set(out.results.map((r) => r.checkKey))).toEqual(new Set(CONNECTOR_BY_KEY.datadog.checks.map((c) => c.key)));
    const by = Object.fromEntries(out.results.map((r) => [r.checkKey, r]));
    expect(by['datadog.admins_limited'].status).toBe('pass');
    expect(by['datadog.admins_limited'].summary).toContain('a@x.co');
    expect(by['datadog.admins_limited'].summary).not.toContain('e@x.co');
    expect(by['datadog.stale_invites'].status).toBe('fail');
    expect(by['datadog.stale_invites'].summary).toContain('c@x.co');
    expect(by['datadog.stale_invites'].summary).not.toContain('d@x.co');
    expect(by['datadog.audit_trail_enabled'].status).toBe('pass');
  });

  it('handles Audit Trail being unavailable or quiet', async () => {
    vi.stubGlobal('fetch', fakeFetch({ '/api/v2/users': USERS, '/api/v2/roles': ROLES, '/api/v2/audit/events': fail(403) }));
    let by = Object.fromEntries((await datadog.run(CREDS, { now: NOW })).results.map((r) => [r.checkKey, r]));
    expect(by['datadog.audit_trail_enabled'].status).toBe('unknown');
    vi.stubGlobal('fetch', fakeFetch({ '/api/v2/users': USERS, '/api/v2/roles': ROLES, '/api/v2/audit/events': { data: [] } }));
    by = Object.fromEntries((await datadog.run(CREDS, { now: NOW })).results.map((r) => [r.checkKey, r]));
    expect(by['datadog.audit_trail_enabled'].status).toBe('warn');
  });

  it('lists accounts', async () => {
    vi.stubGlobal('fetch', fakeFetch({ '/api/v2/users': USERS, '/api/v2/roles': ROLES }));
    const acc = await datadog.accounts!(CREDS, { now: NOW });
    expect(acc).toHaveLength(6);
    expect(acc[0]).toMatchObject({ system: 'Datadog', account: 'a@x.co', displayName: 'A', privilege: 'Admin', enabled: true, lastActiveAt: null });
    expect(acc[1]).toMatchObject({ privilege: 'Member', enabled: true });
    expect(acc[4]).toMatchObject({ account: 'e@x.co', enabled: false });
  });

  it('says what is wrong with a bad key', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ errors: ['Forbidden'] }), { status: 401 })));
    await expect(datadog.run(CREDS, { now: NOW })).rejects.toMatchObject({ status: 401, message: expect.stringContaining('Forbidden') });
  });
});
