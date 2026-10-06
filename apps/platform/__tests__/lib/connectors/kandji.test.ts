import { describe, it, expect, vi, afterEach } from 'vitest';
import { kandji } from '@/lib/connectors/providers/kandji';
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
const CREDS = { subdomain: 'acme', region: 'eu', token: 't' };

afterEach(() => vi.unstubAllGlobals());

describe('kandji connector', () => {
  it('runs every check, Macs only for FileVault and macOS', async () => {
    const f = fakeFetch({
      '/api/v1/devices/d2/details': { filevault: { filevault_enabled: false } },
      '/api/v1/devices/d3/details': fail(404),
      '/api/v1/devices?limit=300&offset=0': [
        { device_id: 'd1', device_name: 'mac-ok', platform: 'Mac', os_version: '15.0', last_check_in: '2026-10-04T00:00:00Z', filevault_enabled: true },
        { device_id: 'd2', device_name: 'mac-old', platform: 'Mac', os_version: '12.7', last_check_in: '2026-10-04T00:00:00Z' },
        { device_id: 'd4', device_name: 'iphone', platform: 'iPhone', os_version: '9.0', last_check_in: '2026-07-01T00:00:00Z' },
      ],
    });
    vi.stubGlobal('fetch', f);
    const out = await kandji.run(CREDS, { now: NOW });
    expect(String(f.mock.calls[0][0])).toContain('https://acme.api.eu.kandji.io/');
    expect(new Set(out.results.map((r) => r.checkKey))).toEqual(new Set(CONNECTOR_BY_KEY.kandji.checks.map((c) => c.key)));
    const by = Object.fromEntries(out.results.map((r) => [r.checkKey, r]));
    expect(by['kandji.filevault_enabled'].status).toBe('fail');
    expect(by['kandji.filevault_enabled'].summary).toContain('mac-old');
    expect(by['kandji.os_up_to_date'].status).toBe('fail');
    expect(by['kandji.os_up_to_date'].summary).not.toContain('iphone');
    expect(by['kandji.device_checkin'].status).toBe('fail');
    expect(by['kandji.device_checkin'].summary).toContain('iphone');
    expect(out.label).toBe('acme.api.eu.kandji.io');
  });

  it('reports FileVault as unknown when no Mac reports it', async () => {
    vi.stubGlobal('fetch', fakeFetch({
      '/api/v1/devices/d1/details': {},
      '/api/v1/devices?limit=300': [{ device_id: 'd1', device_name: 'mac', platform: 'Mac', os_version: '14.5', last_check_in: '2026-10-04T00:00:00Z' }],
    }));
    const out = await kandji.run({ subdomain: 'acme', token: 't' }, { now: NOW });
    const by = Object.fromEntries(out.results.map((r) => [r.checkKey, r]));
    expect(by['kandji.filevault_enabled'].status).toBe('unknown');
    expect(by['kandji.os_up_to_date'].status).toBe('pass');
    expect(by['kandji.device_checkin'].status).toBe('pass');
    expect(out.label).toBe('acme.api.kandji.io');
  });

  it('says what is wrong with a bad token', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ detail: 'Invalid token.' }), { status: 401 })));
    await expect(kandji.run(CREDS, { now: NOW })).rejects.toMatchObject({ status: 401, message: expect.stringContaining('Invalid token') });
  });
});
