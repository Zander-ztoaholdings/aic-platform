import { describe, it, expect, vi, afterEach } from 'vitest';
import { snyk } from '@/lib/connectors/providers/snyk';
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
const CREDS = { orgId: 'org-1', token: 't' };
const issue = (id: string, title: string) => ({ id, attributes: { title, status: 'open', effective_severity_level: 'critical', ignored: false } });

afterEach(() => vi.unstubAllGlobals());

describe('snyk connector', () => {
  it('runs every check', async () => {
    const f = fakeFetch({
      '/rest/orgs/org-1/issues?version=2024-10-15&status=open&effective_severity_level=critical&ignored=false&limit=100&starting_after=x': { data: [issue('i3', 'Remote code execution in log4j-core')], links: {} },
      '/rest/orgs/org-1/issues': { data: [issue('i1', 'Prototype pollution in lodash'), issue('i2', 'Prototype pollution in lodash')], links: { next: '/orgs/org-1/issues?version=2024-10-15&status=open&effective_severity_level=critical&ignored=false&limit=100&starting_after=x' } },
      '/rest/orgs/org-1/projects': { data: [{ id: 'p1', attributes: { name: 'acme/api:package.json', status: 'active' } }, { id: 'p2', attributes: { name: 'acme/old:pom.xml', status: 'inactive' } }], links: { next: null } },
      '/rest/orgs/org-1': { data: { id: 'org-1', attributes: { name: 'Acme' } } },
    });
    vi.stubGlobal('fetch', f);
    const out = await snyk.run(CREDS, { now: NOW });
    expect(new Set(out.results.map((r) => r.checkKey))).toEqual(new Set(CONNECTOR_BY_KEY.snyk.checks.map((c) => c.key)));
    expect(out.results).toHaveLength(CONNECTOR_BY_KEY.snyk.checks.length);
    const by = Object.fromEntries(out.results.map((r) => [r.checkKey, r]));
    expect(by['snyk.no_open_critical'].status).toBe('fail');
    expect(by['snyk.no_open_critical'].summary).toBe('3 open critical vulnerabilities, including Prototype pollution in lodash, Remote code execution in log4j-core.');
    expect(by['snyk.projects_monitored'].status).toBe('fail');
    expect(by['snyk.projects_monitored'].summary).toContain('acme/old:pom.xml');
    expect(out.label).toBe('Acme');
    const urls = f.mock.calls.map(([u]) => String(u));
    expect(urls.every((u) => u.startsWith('https://api.snyk.io/rest/') && u.includes('version=2024-10-15'))).toBe(true);
  });

  it('passes a clean organisation and uses the regional host', async () => {
    const f = fakeFetch({
      '/rest/orgs/org-1/issues': { data: [] },
      '/rest/orgs/org-1/projects': { data: [{ id: 'p1', attributes: { name: 'acme/api', status: 'active' } }] },
      '/rest/orgs/org-1': { data: { id: 'org-1', attributes: {} } },
    });
    vi.stubGlobal('fetch', f);
    const out = await snyk.run({ ...CREDS, region: 'eu' }, { now: NOW });
    const by = Object.fromEntries(out.results.map((r) => [r.checkKey, r]));
    expect(by['snyk.no_open_critical'].status).toBe('pass');
    expect(by['snyk.projects_monitored'].status).toBe('pass');
    expect(out.label).toBe('org-1');
    expect(String(f.mock.calls[0][0])).toContain('https://api.eu.snyk.io/rest/');
  });

  it('marks checks unknown when the plan blocks them', async () => {
    vi.stubGlobal('fetch', fakeFetch({ '/rest/orgs/org-1?': { data: { id: 'org-1', attributes: { name: 'Acme' } } } }));
    const out = await snyk.run(CREDS, { now: NOW });
    expect(out.results.map((r) => r.status)).toEqual(['unknown', 'unknown']);
  });

  it('says what is wrong with a bad token', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ errors: [{ detail: 'Unauthorized' }] }), { status: 401 })));
    await expect(snyk.run(CREDS, { now: NOW })).rejects.toMatchObject({ status: 401, message: expect.stringContaining('Unauthorized') });
  });
});
