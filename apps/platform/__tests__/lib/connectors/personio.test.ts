import { describe, it, expect, vi, afterEach } from 'vitest';
import { personio } from '@/lib/connectors/providers/personio';
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
const CREDS = { clientId: 'id', clientSecret: 'secret' };
const ROUTES = {
  '/v2/auth/token': { access_token: 'tok' },
  '/v2/persons?limit=50&cursor=c2': { _data: [{ id: '3', first_name: 'Cat', last_name: 'Roe', email: 'cat@acme.co', status: 'INACTIVE' }], _meta: { links: {} } },
  '/v2/persons?limit=50': { _data: [{ id: '1', first_name: 'Ann', preferred_name: 'Annie', last_name: 'Lee', email: 'Ann@Acme.co', status: 'ACTIVE' }, { id: '2', first_name: 'Bob', last_name: 'Ng', email: 'bob@acme.co', status: 'INACTIVE' }], _meta: { links: { next: { href: '/v2/persons?limit=50&cursor=c2' } } } },
  '/v2/persons/1/employments': { _data: [{ start_date: '2024-02-01', position: { title: 'Engineer' }, department: { name: 'Tech' } }] },
  '/v2/persons/2/employments': { _data: [{ start_date: '2020-01-01', termination_date: '2022-01-01' }, { start_date: '2023-01-10', termination_date: '2026-08-31' }] },
  '/v2/persons/3/employments': { _data: [] },
};

afterEach(() => vi.unstubAllGlobals());

describe('personio connector', () => {
  it('runs every check', async () => {
    vi.stubGlobal('fetch', fakeFetch(ROUTES));
    const out = await personio.run(CREDS, { now: NOW });
    expect(new Set(out.results.map((r) => r.checkKey))).toEqual(new Set(CONNECTOR_BY_KEY.personio.checks.map((c) => c.key)));
    // Bob by date, Cat by INACTIVE status without a date.
    expect(out.results[0]).toMatchObject({ status: 'pass', summary: '3 people, 2 of whom have left.' });
  });

  it('lists people with their latest employment', async () => {
    vi.stubGlobal('fetch', fakeFetch(ROUTES));
    const people = await personio.people!(CREDS, { now: NOW });
    expect(people).toHaveLength(3);
    expect(people[0]).toEqual({ externalId: '1', name: 'Annie Lee', email: 'ann@acme.co', jobTitle: 'Engineer', department: 'Tech', startDate: '2024-02-01', endDate: null });
    expect(people[1]).toMatchObject({ startDate: '2023-01-10', endDate: '2026-08-31' });
  });

  it('warns when employments cannot be read', async () => {
    const { '/v2/persons/1/employments': _a, '/v2/persons/2/employments': _b, '/v2/persons/3/employments': _c, ...rest } = ROUTES;
    vi.stubGlobal('fetch', fakeFetch(rest));
    expect((await personio.run(CREDS, { now: NOW })).results[0].status).toBe('warn');
  });

  it('says what is wrong with bad credentials', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'invalid client' } }), { status: 401 })));
    await expect(personio.run(CREDS, { now: NOW })).rejects.toMatchObject({ status: 401, message: expect.stringContaining('invalid client') });
  });
});
