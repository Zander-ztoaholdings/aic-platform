import { describe, it, expect, vi, afterEach } from 'vitest';
import { deel } from '@/lib/connectors/providers/deel';
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
const CREDS = { token: 't' };
const WORKERS = [
  { id: 101, full_name: 'Ann Lee', emails: [{ type: 'personal', value: 'ann@home.co' }, { type: 'work', value: 'Ann@Acme.co' }], job_title: 'Engineer', department: { name: 'Tech' }, start_date: '2024-02-01T00:00:00.000Z', termination_date: null, hiring_status: 'active', hiring_type: 'contractor' },
  { id: 102, first_name: 'Bob', last_name: 'Ng', emails: ['bob@acme.co'], department: 'Sales', start_date: '2023-01-10', termination_date: '2026-08-31', hiring_status: 'terminated' },
  { id: 103, full_name: 'Cat Roe', emails: [], start_date: '2025-05-05', hiring_status: 'terminated' },
];

afterEach(() => vi.unstubAllGlobals());

describe('deel connector', () => {
  it('runs every check', async () => {
    vi.stubGlobal('fetch', fakeFetch({ '/rest/v2/people': { data: WORKERS, page: { total_rows: 3 } } }));
    const out = await deel.run(CREDS, { now: NOW });
    expect(new Set(out.results.map((r) => r.checkKey))).toEqual(new Set(CONNECTOR_BY_KEY.deel.checks.map((c) => c.key)));
    expect(out.results[0]).toMatchObject({ status: 'pass', summary: '3 people, 2 of whom have left.' });
  });

  it('lists people', async () => {
    vi.stubGlobal('fetch', fakeFetch({ '/rest/v2/people': { data: WORKERS, page: { total_rows: 3 } } }));
    const people = await deel.people!(CREDS, { now: NOW });
    expect(people[0]).toEqual({ externalId: '101', name: 'Ann Lee', email: 'ann@acme.co', jobTitle: 'Engineer', department: 'Tech', startDate: '2024-02-01', endDate: null });
    expect(people[1]).toMatchObject({ name: 'Bob Ng', email: 'bob@acme.co', department: 'Sales', endDate: '2026-08-31' });
    expect(people[2]).toMatchObject({ email: null, endDate: null });
  });

  it('follows offsets until a short page', async () => {
    const full = Array.from({ length: 200 }, (_, i) => ({ id: i, full_name: `W${i}`, start_date: '2025-01-01' }));
    const f = fakeFetch({ '/rest/v2/people?limit=200&offset=200': { data: [{ id: 999, full_name: 'Last', start_date: '2025-01-01' }], page: {} }, '/rest/v2/people?limit=200&offset=0': { data: full, page: {} } });
    vi.stubGlobal('fetch', f);
    expect(await deel.people!(CREDS, { now: NOW })).toHaveLength(201);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('says what is wrong with a bad token', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ errors: [{ message: 'Invalid token' }] }), { status: 401 })));
    await expect(deel.run(CREDS, { now: NOW })).rejects.toMatchObject({ status: 401, message: expect.stringContaining('Invalid token') });
  });
});
