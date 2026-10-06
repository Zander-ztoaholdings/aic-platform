import { describe, it, expect, vi, afterEach } from 'vitest';
import { salesforce } from '@/lib/connectors/providers/salesforce';
import { CONNECTOR_BY_KEY } from '@/lib/connectors/catalog';

/** A fake fetch answering by the SOQL object queried, since every query shares one path. */
function fakeFetch(routes: Record<string, unknown>) {
  return vi.fn(async (url: string | URL) => {
    const u = new URL(String(url));
    if (u.pathname === '/services/oauth2/token') return new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 });
    const q = u.searchParams.get('q') ?? '';
    const key = Object.keys(routes).find((k) => q.includes(k) || u.pathname === k);
    if (!key) return new Response(JSON.stringify([{ message: `no route ${u.pathname}`, errorCode: 'NOT_FOUND' }]), { status: 404 });
    return new Response(JSON.stringify(routes[key]), { status: 200 });
  });
}

const NOW = new Date('2026-10-05T10:00:00Z');
const CREDS = { domain: 'acme.my.salesforce.com', clientId: 'id', clientSecret: 's' };
const asg = (id: string, name: string) => ({ AssigneeId: id, Assignee: { Name: name, Username: `${id}@acme.com` } });

afterEach(() => vi.unstubAllGlobals());

describe('salesforce connector', () => {
  it('runs every check and follows nextRecordsUrl', async () => {
    const f = fakeFetch({
      'FROM PermissionSetAssignment': { done: false, nextRecordsUrl: '/services/data/v61.0/query/01gNEXT-2000', records: [asg('u1', 'Ann'), asg('u2', 'Ben'), asg('u1', 'Ann')] },
      '/services/data/v61.0/query/01gNEXT-2000': { done: true, records: [asg('u3', 'Cat'), asg('u4', 'Dan')] },
      'FROM User WHERE IsActive': { done: true, records: [
        { Id: 'u1', Name: 'Ann', Username: 'ann@acme.com', LastLoginDate: '2026-10-01T00:00:00Z', CreatedDate: '2024-01-01T00:00:00Z' },
        { Id: 'u5', Name: 'Eve', Username: 'eve@acme.com', LastLoginDate: null, CreatedDate: '2024-01-01T00:00:00Z' },
      ] },
    });
    vi.stubGlobal('fetch', f);
    const out = await salesforce.run(CREDS, { now: NOW });
    expect(String(f.mock.calls[0][0])).toBe('https://acme.my.salesforce.com/services/oauth2/token');
    expect(new Set(out.results.map((r) => r.checkKey))).toEqual(new Set(CONNECTOR_BY_KEY.salesforce.checks.map((c) => c.key)));
    const by = Object.fromEntries(out.results.map((r) => [r.checkKey, r]));
    expect(by['salesforce.admins_limited'].status).toBe('fail');
    expect(by['salesforce.admins_limited'].summary).toContain('4 people who can modify all data');
    expect(by['salesforce.stale_accounts'].status).toBe('fail');
    expect(by['salesforce.stale_accounts'].summary).toContain('Eve');
    expect(out.label).toBe('acme.my.salesforce.com');
  });

  it('lists accounts', async () => {
    vi.stubGlobal('fetch', fakeFetch({ 'FROM User WHERE UserType': { done: true, records: [
      { Id: 'u1', Name: 'Ann', Username: 'ann@acme.com', Email: 'ann@acme.com', IsActive: true, LastLoginDate: '2026-10-01T00:00:00Z', Profile: { Name: 'System Administrator' } },
      { Id: 'u2', Name: 'Ben', Username: 'ben@acme.com', Email: null, IsActive: false, LastLoginDate: null, Profile: { Name: 'Standard User' } },
    ] } }));
    const acc = await salesforce.accounts!(CREDS, { now: NOW });
    expect(acc).toEqual([
      { system: 'Salesforce', account: 'ann@acme.com', displayName: 'Ann', privilege: 'System Administrator', lastActiveAt: '2026-10-01T00:00:00Z', enabled: true },
      { system: 'Salesforce', account: 'ben@acme.com', displayName: 'Ben', privilege: 'Standard User', lastActiveAt: null, enabled: false },
    ]);
  });

  it('says what is wrong with a bad consumer secret', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'invalid_client', error_description: 'invalid client credentials' }), { status: 400 })));
    await expect(salesforce.run(CREDS, { now: NOW })).rejects.toMatchObject({ status: 400, message: expect.stringContaining('invalid client credentials') });
  });
});
