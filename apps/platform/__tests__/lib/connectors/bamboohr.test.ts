import { describe, it, expect, vi, afterEach } from 'vitest';
import { bamboohr } from '@/lib/connectors/providers/bamboohr';
import { isoDate } from '@/lib/connectors/hr';
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
const CREDS = { subdomain: 'acme', token: 'k' };
const EMPLOYEES = [
  { id: '1', displayName: 'Ann Lee', workEmail: 'Ann@Acme.co', jobTitle: 'Engineer', department: 'Tech', hireDate: '2024-02-01', terminationDate: '0000-00-00', status: 'Active' },
  { id: '2', firstName: 'Bob', lastName: 'Ng', workEmail: 'bob@acme.co', hireDate: '2023-01-10', terminationDate: '2026-08-31', status: 'Inactive' },
  { id: 3, displayName: 'Cat Roe', workEmail: '', hireDate: '2025-05-05', terminationDate: '', status: 'Inactive' },
];

afterEach(() => vi.unstubAllGlobals());

describe('bamboohr connector', () => {
  it('runs every check', async () => {
    const f = fakeFetch({ '/api/gateway.php/acme/v1/reports/custom': { employees: EMPLOYEES } });
    vi.stubGlobal('fetch', f);
    const out = await bamboohr.run(CREDS, { now: NOW });
    expect(new Set(out.results.map((r) => r.checkKey))).toEqual(new Set(CONNECTOR_BY_KEY.bamboohr.checks.map((c) => c.key)));
    expect(out.results[0]).toMatchObject({ status: 'pass', summary: '3 people, 2 of whom have left.', subject: 'acme.bamboohr.com' });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('onlyCurrent=false');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from('k:x').toString('base64')}`);
  });

  it('warns when no dates come back, and is unknown when empty', async () => {
    vi.stubGlobal('fetch', fakeFetch({ '/api/gateway.php/acme/v1/reports/custom': { employees: [{ id: '1', displayName: 'Ann' }] } }));
    expect((await bamboohr.run(CREDS, { now: NOW })).results[0].status).toBe('warn');
    vi.stubGlobal('fetch', fakeFetch({ '/api/gateway.php/acme/v1/reports/custom': { employees: [] } }));
    expect((await bamboohr.run(CREDS, { now: NOW })).results[0].status).toBe('unknown');
  });

  it('lists people, including leavers', async () => {
    vi.stubGlobal('fetch', fakeFetch({ '/api/gateway.php/acme/v1/reports/custom': { employees: EMPLOYEES } }));
    const people = await bamboohr.people!(CREDS, { now: NOW });
    expect(people).toHaveLength(3);
    expect(people[0]).toEqual({ externalId: '1', name: 'Ann Lee', email: 'ann@acme.co', jobTitle: 'Engineer', department: 'Tech', startDate: '2024-02-01', endDate: null });
    expect(people[1]).toMatchObject({ name: 'Bob Ng', endDate: '2026-08-31' });
    expect(people[2]).toMatchObject({ externalId: '3', email: null, endDate: null });
  });

  it('normalises dates', () => {
    expect(isoDate('2026-01-02T00:00:00Z')).toBe('2026-01-02');
    expect(isoDate('02/01/2026')).toBe('2026-01-02');
    expect(isoDate('0000-00-00')).toBeNull();
    expect(isoDate('')).toBeNull();
  });

  it('says what is wrong with a bad key', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Unauthorized', { status: 401 })));
    await expect(bamboohr.run(CREDS, { now: NOW })).rejects.toMatchObject({ status: 401 });
  });
});
