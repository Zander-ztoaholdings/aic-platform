import { describe, it, expect, vi, afterEach } from 'vitest';
import { jamf } from '@/lib/connectors/providers/jamf';
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
const CREDS = { baseUrl: 'https://acme.jamfcloud.com/', clientId: 'id', clientSecret: 's' };
const pc = (id: string, name: string, fv: string | null, version: string, last: string) => ({
  id, general: { name, lastContactTime: last }, operatingSystem: { version },
  diskEncryption: fv ? { bootPartitionEncryptionDetails: { partitionFileVault2State: fv } } : null,
});

afterEach(() => vi.unstubAllGlobals());

describe('jamf connector', () => {
  it('runs every check', async () => {
    vi.stubGlobal('fetch', fakeFetch({
      '/api/oauth/token': { access_token: 'tok' },
      '/api/v1/computers-inventory': { totalCount: 3, results: [
        pc('1', 'mac-ok', 'ENCRYPTED', '15.1', '2026-10-04T00:00:00Z'),
        pc('2', 'mac-plain', 'NOT_ENCRYPTED', '13.6.1', '2026-08-01T00:00:00Z'),
        pc('3', 'mac-unknown', null, '14.0', '2026-10-03T00:00:00Z'),
      ] },
    }));
    const out = await jamf.run(CREDS, { now: NOW });
    expect(new Set(out.results.map((r) => r.checkKey))).toEqual(new Set(CONNECTOR_BY_KEY.jamf.checks.map((c) => c.key)));
    const by = Object.fromEntries(out.results.map((r) => [r.checkKey, r]));
    expect(by['jamf.filevault_enabled'].status).toBe('fail');
    expect(by['jamf.filevault_enabled'].summary).toContain('mac-plain');
    expect(by['jamf.filevault_enabled'].summary).not.toContain('mac-unknown');
    expect(by['jamf.os_up_to_date'].status).toBe('fail');
    expect(by['jamf.os_up_to_date'].summary).toContain('mac-plain');
    expect(by['jamf.device_checkin'].status).toBe('fail');
    expect(out.label).toBe('acme.jamfcloud.com');
  });

  it('treats missing FileVault status as unknown and honours minMacos', async () => {
    vi.stubGlobal('fetch', fakeFetch({
      '/api/oauth/token': { access_token: 'tok' },
      '/api/v1/computers-inventory': { totalCount: 1, results: [pc('1', 'mac', null, '13.2', '2026-10-04T00:00:00Z')] },
    }));
    const out = await jamf.run({ ...CREDS, minMacos: '13' }, { now: NOW });
    const by = Object.fromEntries(out.results.map((r) => [r.checkKey, r]));
    expect(by['jamf.filevault_enabled'].status).toBe('unknown');
    expect(by['jamf.os_up_to_date'].status).toBe('pass');
    expect(by['jamf.device_checkin'].status).toBe('pass');
  });

  it('says what is wrong with a bad client secret', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'invalid_client' }), { status: 401 })));
    await expect(jamf.run(CREDS, { now: NOW })).rejects.toMatchObject({ status: 401, message: expect.stringContaining('invalid_client') });
  });
});
