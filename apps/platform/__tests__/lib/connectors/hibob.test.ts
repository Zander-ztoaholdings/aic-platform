import { describe, it, expect, vi, afterEach } from 'vitest';
import { hibob } from '@/lib/connectors/providers/hibob';
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
const CREDS = { userId: 'SERVICE-1', token: 't' };
const EMPLOYEES = [
  { id: '11', displayName: 'Ann Lee', email: 'Ann@Acme.co', work: { title: 'Engineer', department: 'Tech', startDate: '2024-02-01' }, internal: { status: 'Active', terminationDate: null } },
  { id: '12', displayName: 'Bob Ng', email: 'bob@acme.co', work: { title: 'Sales', department: { name: 'Sales' }, startDate: '2023-01-10' }, internal: { status: 'Inactive', terminationDate: '2026-09-01' } },
  { 'root.id': '13', 'root.displayName': 'Cat Roe', 'root.email': 'cat@acme.co', 'work.startDate': '2025-05-05', 'internal.terminationDate': '2026-12-31', 'internal.status': 'Active' },
];

afterEach(() => vi.unstubAllGlobals());

describe('hibob connector', () => {
  it('runs every check', async () => {
    const f = fakeFetch({ '/v1/people/search': { employees: EMPLOYEES } });
    vi.stubGlobal('fetch', f);
    const out = await hibob.run(CREDS, { now: NOW });
    expect(new Set(out.results.map((r) => r.checkKey))).toEqual(new Set(CONNECTOR_BY_KEY.hibob.checks.map((c) => c.key)));
    expect(out.results[0]).toMatchObject({ status: 'pass', summary: '3 people, 1 of whom has left.' });
    const body = JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.showInactive).toBe(true);
  });

  it('warns when dates are hidden', async () => {
    vi.stubGlobal('fetch', fakeFetch({ '/v1/people/search': { employees: [{ id: '1', displayName: 'Ann', email: 'a@acme.co' }] } }));
    expect((await hibob.run(CREDS, { now: NOW })).results[0].status).toBe('warn');
  });

  it('lists people from nested and flat shapes', async () => {
    vi.stubGlobal('fetch', fakeFetch({ '/v1/people/search': { employees: EMPLOYEES } }));
    const people = await hibob.people!(CREDS, { now: NOW });
    expect(people[0]).toEqual({ externalId: '11', name: 'Ann Lee', email: 'ann@acme.co', jobTitle: 'Engineer', department: 'Tech', startDate: '2024-02-01', endDate: null });
    expect(people[1]).toMatchObject({ department: 'Sales', endDate: '2026-09-01' });
    expect(people[2]).toMatchObject({ externalId: '13', name: 'Cat Roe', email: 'cat@acme.co', startDate: '2025-05-05', endDate: '2026-12-31' });
  });

  it('says what is wrong with a bad token', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })));
    await expect(hibob.run(CREDS, { now: NOW })).rejects.toMatchObject({ status: 401, message: expect.stringContaining('Unauthorized') });
  });
});
