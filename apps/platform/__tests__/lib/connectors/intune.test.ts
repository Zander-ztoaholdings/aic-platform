import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { intune } from '@/lib/connectors/providers/intune';
import { CONNECTOR_BY_KEY } from '@/lib/connectors/catalog';

/** A fake fetch answering by URL path. Each connector test uses this shape. */
function fakeFetch(routes: Record<string, unknown>, headers: Record<string, Record<string, string>> = {}) {
  return vi.fn(async (url: string | URL) => {
    const u = new URL(String(url));
    const key = Object.keys(routes).find((k) => (u.pathname + u.search).startsWith(k) || u.pathname === k);
    if (!key) return new Response(JSON.stringify({ error: { message: `no route ${u.pathname}` } }), { status: 404 });
    return new Response(JSON.stringify(routes[key]), { status: 200, headers: headers[key] ?? {} });
  });
}

const NOW = new Date('2026-10-05T10:00:00Z');
const CTX = { now: NOW, microsoftTenant: 'tenant-1' };
const dev = (name: string, o: Record<string, unknown> = {}) => ({ id: name, deviceName: name, userPrincipalName: `${name}@acme.co.za`, operatingSystem: 'Windows', isEncrypted: true, complianceState: 'compliant', lastSyncDateTime: '2026-10-04T00:00:00Z', ...o });

beforeEach(() => { process.env.MS_CLIENT_ID = 'cid'; process.env.MS_CLIENT_SECRET = 'secret'; });
afterEach(() => vi.unstubAllGlobals());

describe('intune connector', () => {
  it('runs every check across pages', async () => {
    const fetch = fakeFetch({
      '/tenant-1/oauth2/v2.0/token': { access_token: 'graph' },
      '/v1.0/deviceManagement/managedDevices?$skiptoken=2': { value: [dev('mac1', { operatingSystem: 'macOS', isEncrypted: false }), dev('phone', { operatingSystem: 'iOS', isEncrypted: false, complianceState: 'inGracePeriod' })] },
      '/v1.0/deviceManagement/managedDevices': { value: [dev('pc1'), dev('pc2', { complianceState: 'noncompliant', lastSyncDateTime: '2026-08-01T00:00:00Z' })], '@odata.nextLink': 'https://graph.microsoft.com/v1.0/deviceManagement/managedDevices?$skiptoken=2' },
    });
    vi.stubGlobal('fetch', fetch);
    const out = await intune.run({}, CTX);
    const by = Object.fromEntries(out.results.map((r) => [r.checkKey, r]));
    expect(new Set(out.results.map((r) => r.checkKey))).toEqual(new Set(CONNECTOR_BY_KEY.intune.checks.map((c) => c.key)));
    expect(out.results).toHaveLength(CONNECTOR_BY_KEY.intune.checks.length);
    expect(by['intune.device_encryption'].status).toBe('fail');
    expect(by['intune.device_encryption'].summary).toContain('mac1 (mac1@acme.co.za)');
    expect(by['intune.device_encryption'].summary).not.toContain('phone');
    expect(by['intune.device_compliant'].status).toBe('fail');
    expect(by['intune.device_compliant'].summary).toContain('pc2');
    expect(by['intune.device_checkin'].status).toBe('fail');
    expect(by['intune.device_checkin'].summary).toContain('pc2');
    expect(by['intune.device_checkin'].summary).not.toContain('pc1');
    expect(out.label).toBe('Intune');
    const first = new URL(String(fetch.mock.calls[1][0]));
    expect(first.searchParams.get('$select')).toContain('isEncrypted');
  });

  it('warns on devices in their grace period only, and passes the rest', async () => {
    vi.stubGlobal('fetch', fakeFetch({
      '/tenant-1/oauth2/v2.0/token': { access_token: 'graph' },
      '/v1.0/deviceManagement/managedDevices': { value: [dev('pc1'), dev('pc2', { complianceState: 'inGracePeriod' })] },
    }));
    const out = await intune.run({}, CTX);
    expect(out.results.map((r) => r.status)).toEqual(['pass', 'warn', 'pass']);
  });

  it('marks every check unknown without an Intune licence', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => String(url).includes('login.microsoftonline.com')
      ? new Response(JSON.stringify({ access_token: 'graph' }))
      : new Response(JSON.stringify({ error: { message: 'Forbidden' } }), { status: 403 })));
    const out = await intune.run({}, CTX);
    expect(out.results.map((r) => r.status)).toEqual(['unknown', 'unknown', 'unknown']);
  });

  it('needs Microsoft 365 connected first', async () => {
    await expect(intune.run({}, { now: NOW })).rejects.toMatchObject({ status: 400, message: expect.stringContaining('Connect Microsoft 365 first') });
  });

  it('surfaces an invalid token as a connector error', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => String(url).includes('login.microsoftonline.com')
      ? new Response(JSON.stringify({ access_token: 'graph' }))
      : new Response(JSON.stringify({ error: { message: 'Access token has expired.' } }), { status: 401 })));
    await expect(intune.run({}, CTX)).rejects.toMatchObject({ status: 401, message: expect.stringContaining('Access token has expired') });
  });
});
