import { describe, it, expect, vi, afterEach } from 'vitest';
import { rippling } from '@/lib/connectors/providers/rippling';
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
const ROUTES = {
  '/workers?limit=100&cursor=n2': { results: [{ id: 'w3', legal_first_name: 'Cat', legal_last_name: 'Roe', work_email: 'cat@acme.co', status: 'TERMINATED', start_date: '2025-05-05' }], next_link: null },
  '/workers?limit=100': {
    results: [
      { id: 'w1', user: { name: { given_name: 'Ann', family_name: 'Lee' } }, work_email: 'Ann@Acme.co', title: 'Engineer', department: { name: 'Tech' }, status: 'ACTIVE', start_date: '2024-02-01' },
      { id: 'w2', display_name: 'Bob Ng', work_email: 'bob@acme.co', status: 'TERMINATED', start_date: '2023-01-10', end_date: '2026-08-31' },
    ],
    next_link: 'https://rest.ripplingapis.com/workers?limit=100&cursor=n2',
  },
};

afterEach(() => vi.unstubAllGlobals());

describe('rippling connector', () => {
  it('runs every check', async () => {
    vi.stubGlobal('fetch', fakeFetch(ROUTES));
    const out = await rippling.run(CREDS, { now: NOW });
    expect(new Set(out.results.map((r) => r.checkKey))).toEqual(new Set(CONNECTOR_BY_KEY.rippling.checks.map((c) => c.key)));
    expect(out.results[0]).toMatchObject({ status: 'pass', summary: '3 people, 2 of whom have left.' });
  });

  it('lists people across pages', async () => {
    vi.stubGlobal('fetch', fakeFetch(ROUTES));
    const people = await rippling.people!(CREDS, { now: NOW });
    expect(people).toHaveLength(3);
    expect(people[0]).toEqual({ externalId: 'w1', name: 'Ann Lee', email: 'ann@acme.co', jobTitle: 'Engineer', department: 'Tech', startDate: '2024-02-01', endDate: null });
    expect(people[1]).toMatchObject({ name: 'Bob Ng', endDate: '2026-08-31' });
    expect(people[2]).toMatchObject({ name: 'Cat Roe', endDate: null });
  });

  it('is unknown when no workers come back', async () => {
    vi.stubGlobal('fetch', fakeFetch({ '/workers': { results: [] } }));
    expect((await rippling.run(CREDS, { now: NOW })).results[0].status).toBe('unknown');
  });

  it('says what is wrong with a bad token', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ detail: 'Invalid token.' }), { status: 401 })));
    await expect(rippling.run(CREDS, { now: NOW })).rejects.toMatchObject({ status: 401, message: expect.stringContaining('Invalid token') });
  });
});
