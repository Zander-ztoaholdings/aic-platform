import { describe, it, expect, vi, afterEach } from 'vitest';
import { linear } from '@/lib/connectors/providers/linear';
import { CONNECTOR_BY_KEY } from '@/lib/connectors/catalog';

/**
 * A fake fetch in the shape the other connector tests use. Linear has one
 * GraphQL URL, so this one answers by a substring of the query instead of the path.
 */
function fakeFetch(routes: Record<string, unknown | ((vars: Record<string, unknown>) => unknown)>) {
  return vi.fn(async (_url: string | URL, init?: RequestInit) => {
    const { query, variables } = JSON.parse(String(init?.body ?? '{}')) as { query: string; variables: Record<string, unknown> };
    const key = Object.keys(routes).find((k) => query.includes(k));
    if (!key) return new Response(JSON.stringify({ errors: [{ message: `no route for ${query.slice(0, 40)}` }] }), { status: 200 });
    const r = routes[key];
    return new Response(JSON.stringify({ data: typeof r === 'function' ? r(variables) : r }), { status: 200 });
  });
}

const NOW = new Date('2026-10-05T10:00:00Z');
const done = { hasNextPage: false, endCursor: null };
const user = (id: string, extra: Record<string, unknown> = {}) => ({ id, name: id.toUpperCase(), email: `${id}@acme.co`, admin: false, owner: false, guest: false, active: true, app: false, lastSeen: '2026-10-01T00:00:00Z', createdAt: '2025-01-01T00:00:00Z', ...extra });

afterEach(() => vi.unstubAllGlobals());

describe('linear connector', () => {
  it('runs every check', async () => {
    const f = fakeFetch({
      'users(': (v: Record<string, unknown>) => (v.after
        ? { users: { nodes: [user('dan', { admin: true }), user('bot', { admin: true, app: true })], pageInfo: done } }
        : { users: { nodes: [user('ann', { owner: true, admin: true }), user('ben', { admin: true }), user('cat', { admin: true }), user('eve', { admin: true, active: false })], pageInfo: { hasNextPage: true, endCursor: 'c1' } } }),
      'organization': { organization: { name: 'Acme', samlEnabled: false } },
      'issues(': { issues: { nodes: [
        { identifier: 'SEC-1', title: 'Rotate keys', priority: 1, createdAt: '2026-07-01T00:00:00Z' },
        { identifier: 'SEC-2', title: 'Patch', priority: 2, createdAt: '2026-09-20T00:00:00Z' },
        { identifier: 'SEC-3', title: 'Docs', priority: 4, createdAt: '2025-01-01T00:00:00Z' },
      ], pageInfo: done } },
    });
    vi.stubGlobal('fetch', f);
    const out = await linear.run({ token: 'lin_api_x' }, { now: NOW });
    expect(new Set(out.results.map((r) => r.checkKey))).toEqual(new Set(CONNECTOR_BY_KEY.linear.checks.map((c) => c.key)));
    expect(out.results).toHaveLength(CONNECTOR_BY_KEY.linear.checks.length);
    const by = Object.fromEntries(out.results.map((r) => [r.checkKey, r]));
    expect(by['linear.admins_limited'].status).toBe('fail');
    expect(by['linear.admins_limited'].detail).toEqual({ admins: ['ANN', 'BEN', 'CAT', 'DAN'] });
    expect(by['linear.sso_enforced'].status).toBe('fail');
    expect(by['linear.security_issue_sla'].status).toBe('fail');
    expect(by['linear.security_issue_sla'].summary).toBe('1 urgent or high security issue open for more than 30 days: SEC-1.');
    expect(out.label).toBe('Acme');
    expect((f.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe('lin_api_x');
  });

  it('passes with single sign-on and a custom deadline, and sends OAuth tokens as Bearer', async () => {
    const f = fakeFetch({
      'users(': { users: { nodes: [user('ann', { admin: true }), user('ben', { admin: true })], pageInfo: done } },
      'organization': { organization: { name: 'Acme', samlEnabled: true } },
      'issues(': { issues: { nodes: [{ identifier: 'SEC-1', priority: 1, createdAt: '2026-07-01T00:00:00Z' }], pageInfo: done } },
    });
    vi.stubGlobal('fetch', f);
    const out = await linear.run({ token: 'lin_oauth_x', slaDays: '120', label: 'vuln' }, { now: NOW });
    expect(out.results.map((r) => r.status)).toEqual(['pass', 'pass', 'pass']);
    expect((f.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe('Bearer lin_oauth_x');
    expect(JSON.parse(String(f.mock.calls[2][1]?.body)).variables.label).toBe('vuln');
  });

  it('lists accounts', async () => {
    vi.stubGlobal('fetch', fakeFetch({
      'users(': { users: { nodes: [user('ann', { owner: true, admin: true }), user('ben', { guest: true, active: false, lastSeen: null }), user('bot', { app: true })], pageInfo: done } },
    }));
    const acc = await linear.accounts!({ token: 't' }, { now: NOW });
    expect(acc).toEqual([
      { system: 'Linear', account: 'ann@acme.co', displayName: 'ANN', privilege: 'Owner', lastActiveAt: '2026-10-01T00:00:00Z', enabled: true },
      { system: 'Linear', account: 'ben@acme.co', displayName: 'BEN', privilege: 'Guest', lastActiveAt: null, enabled: false },
    ]);
  });

  it('says what is wrong with a bad key', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ errors: [{ message: 'Authentication required, not authenticated', extensions: { code: 'AUTHENTICATION_ERROR' } }] }), { status: 400 })));
    await expect(linear.run({ token: 'bad' }, { now: NOW })).rejects.toMatchObject({ status: 401, message: expect.stringContaining('not authenticated') });
  });

  it('treats GraphQL errors with HTTP 200 as failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ errors: [{ message: 'Rate limit exceeded' }] }), { status: 200 })));
    await expect(linear.run({ token: 't' }, { now: NOW })).rejects.toMatchObject({ status: 400, message: expect.stringContaining('Rate limit exceeded') });
  });
});
