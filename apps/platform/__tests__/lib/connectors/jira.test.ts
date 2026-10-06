import { describe, it, expect, vi, afterEach } from 'vitest';
import { jira } from '@/lib/connectors/providers/jira';
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
const CREDS = { site: 'acme.atlassian.net', email: 'aic@acme.co', token: 't' };
const issue = (key: string, priority: string, created: string) => ({ key, fields: { summary: `Fix ${key}`, created, priority: { name: priority }, status: { name: 'To Do' } } });

afterEach(() => vi.unstubAllGlobals());

describe('jira connector', () => {
  it('runs every check', async () => {
    const f = vi.fn(async (url: string | URL) => {
      const u = new URL(String(url));
      const page = u.searchParams.get('nextPageToken')
        ? { issues: [issue('SEC-3', 'Highest', '2026-01-10T00:00:00.000+0200')], isLast: true }
        : { issues: [issue('SEC-1', 'High', '2026-08-01T00:00:00.000+0200'), issue('SEC-2', 'High', '2026-09-30T00:00:00.000+0200'), issue('SEC-4', 'Low', '2025-01-01T00:00:00.000+0200')], nextPageToken: 'p2' };
      return new Response(JSON.stringify(page), { status: 200 });
    });
    vi.stubGlobal('fetch', f);
    const out = await jira.run(CREDS, { now: NOW });
    expect(new Set(out.results.map((r) => r.checkKey))).toEqual(new Set(CONNECTOR_BY_KEY.jira.checks.map((c) => c.key)));
    expect(out.results).toHaveLength(CONNECTOR_BY_KEY.jira.checks.length);
    expect(out.results[0].status).toBe('fail');
    expect(out.results[0].summary).toBe('2 high-priority security tickets open for more than 30 days: SEC-1, SEC-3.');
    expect(out.label).toBe('acme.atlassian.net');
    const first = new URL(String(f.mock.calls[0][0]));
    expect(first.pathname).toBe('/rest/api/3/search/jql');
    expect(first.searchParams.get('jql')).toContain('labels = "security" AND statusCategory != Done');
  });

  it('respects a custom label and deadline', async () => {
    const f = fakeFetch({ '/rest/api/3/search/jql': { issues: [issue('SEC-1', 'High', '2026-08-01T00:00:00.000+0200')], isLast: true } });
    vi.stubGlobal('fetch', f);
    const out = await jira.run({ ...CREDS, site: 'acme', label: 'vuln', slaDays: '90' }, { now: NOW });
    expect(out.results[0].status).toBe('pass');
    expect(out.results[0].summary).toContain('"vuln"');
    expect(new URL(String(f.mock.calls[0][0])).host).toBe('acme.atlassian.net');
  });

  it('lists accounts', async () => {
    vi.stubGlobal('fetch', fakeFetch({
      '/rest/api/3/users/search?maxResults=1000&startAt=0': [
        { accountId: '1', accountType: 'atlassian', displayName: 'Ann', emailAddress: 'ann@acme.co', active: true },
        { accountId: '2', accountType: 'atlassian', displayName: 'Ben', active: false },
        { accountId: '3', accountType: 'app', displayName: 'Slack', active: true },
        { accountId: '4', accountType: 'customer', displayName: 'Customer', active: true },
      ],
      '/rest/api/3/users/search?maxResults=1000&startAt=4': [],
    }));
    const acc = await jira.accounts!(CREDS, { now: NOW });
    expect(acc).toEqual([
      { system: 'Jira', account: 'ann@acme.co', displayName: 'Ann', privilege: null, lastActiveAt: null, enabled: true },
      { system: 'Jira', account: 'Ben', displayName: 'Ben', privilege: null, lastActiveAt: null, enabled: false },
    ]);
  });

  it('says what is wrong with a bad token', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ errorMessages: ['Client must be authenticated to access this resource.'], message: 'Client must be authenticated' }), { status: 401 })));
    await expect(jira.run(CREDS, { now: NOW })).rejects.toMatchObject({ status: 401, message: expect.stringContaining('authenticated') });
  });
});
