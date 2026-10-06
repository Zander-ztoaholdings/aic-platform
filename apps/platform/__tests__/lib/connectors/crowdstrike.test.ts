import { describe, it, expect, vi, afterEach } from 'vitest';
import { crowdstrike } from '@/lib/connectors/providers/crowdstrike';
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
const CREDS = { clientId: 'id', clientSecret: 's', cloud: 'eu-1' };
const HOSTS = {
  '/oauth2/token': { access_token: 'tok' },
  '/devices/queries/devices/v1': { resources: ['h1', 'h2', 'h3'] },
  '/devices/entities/devices/v2': { resources: [
    { device_id: 'h1', hostname: 'laptop-1', last_seen: '2026-10-05T08:00:00Z', reduced_functionality_mode: 'no' },
    { device_id: 'h2', hostname: 'laptop-2', last_seen: '2026-09-01T08:00:00Z', reduced_functionality_mode: 'no' },
    { device_id: 'h3', hostname: 'server-1', last_seen: '2026-10-05T08:00:00Z', reduced_functionality_mode: 'yes' },
  ] },
};

afterEach(() => vi.unstubAllGlobals());

describe('crowdstrike connector', () => {
  it('runs every check', async () => {
    const f = fakeFetch({
      ...HOSTS,
      '/spotlight/combined/vulnerabilities/v1': { resources: [{ cve: { id: 'CVE-2026-0001' }, host_info: { hostname: 'laptop-1' } }], meta: { pagination: { total: 1 } } },
    });
    vi.stubGlobal('fetch', f);
    const out = await crowdstrike.run(CREDS, { now: NOW });
    expect(String(f.mock.calls[0][0])).toBe('https://api.eu-1.crowdstrike.com/oauth2/token');
    const spot = f.mock.calls.map((c) => String(c[0])).find((u) => u.includes('spotlight'))!;
    expect(new URL(spot).searchParams.get('filter')).toBe("status:'open'+cve.severity:'CRITICAL'");
    expect(new Set(out.results.map((r) => r.checkKey))).toEqual(new Set(CONNECTOR_BY_KEY.crowdstrike.checks.map((c) => c.key)));
    const by = Object.fromEntries(out.results.map((r) => [r.checkKey, r]));
    expect(by['crowdstrike.edr_coverage'].status).toBe('fail');
    expect(by['crowdstrike.edr_coverage'].summary).toContain('laptop-2');
    expect(by['crowdstrike.edr_coverage'].summary).toContain('server-1');
    expect(by['crowdstrike.no_open_critical_vulns'].status).toBe('fail');
    expect(by['crowdstrike.no_open_critical_vulns'].summary).toContain('CVE-2026-0001');
    expect(out.label).toBe('CrowdStrike Falcon');
  });

  it('marks vulnerabilities unknown without Spotlight', async () => {
    vi.stubGlobal('fetch', fakeFetch({ ...HOSTS, '/spotlight/combined/vulnerabilities/v1': fail(403) }));
    const out = await crowdstrike.run(CREDS, { now: NOW });
    const by = Object.fromEntries(out.results.map((r) => [r.checkKey, r]));
    expect(by['crowdstrike.no_open_critical_vulns'].status).toBe('unknown');
    expect(by['crowdstrike.no_open_critical_vulns'].summary).toContain('Spotlight');
  });

  it('says what is wrong with a bad client secret', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ errors: [{ code: 401, message: 'access denied, invalid bearer token' }] }), { status: 401 })));
    await expect(crowdstrike.run(CREDS, { now: NOW })).rejects.toMatchObject({ status: 401, message: expect.stringContaining('access denied') });
  });
});
