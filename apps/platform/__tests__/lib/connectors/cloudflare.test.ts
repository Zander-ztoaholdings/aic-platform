import { describe, it, expect, vi, afterEach } from 'vitest';
import { cloudflare } from '@/lib/connectors/providers/cloudflare';
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
const CREDS = { accountId: 'acc1', token: 't' };
const ok = <T>(result: T, total_pages = 1) => ({ success: true, result, result_info: { page: 1, total_pages }, errors: [] });
const SUPER = { name: 'Super Administrator - All Privileges' };
const member = (id: string, email: string, twoFa: boolean | undefined, roles = [{ name: 'Administrator Read Only' }], status = 'accepted') =>
  ({ id, status, user: { email, first_name: id.toUpperCase(), last_name: 'X', ...(twoFa === undefined ? {} : { two_factor_authentication_enabled: twoFa }) }, roles });

afterEach(() => vi.unstubAllGlobals());

describe('cloudflare connector', () => {
  it('runs every check', async () => {
    vi.stubGlobal('fetch', fakeFetch({
      '/client/v4/accounts/acc1/members': ok([
        member('a', 'a@x.co', true, [SUPER]), member('b', 'b@x.co', false, [SUPER]), member('c', 'c@x.co', true, [SUPER]),
        member('d', 'd@x.co', true, [SUPER]), member('e', 'e@x.co', false, [SUPER], 'pending'),
      ]),
      '/client/v4/accounts/acc1': ok({ id: 'acc1', name: 'Acme' }),
      '/client/v4/zones/z1/settings/min_tls_version': ok({ value: '1.2' }),
      '/client/v4/zones/z1/settings/always_use_https': ok({ value: 'on' }),
      '/client/v4/zones/z1/settings/ssl': ok({ value: 'strict' }),
      '/client/v4/zones/z2/settings/min_tls_version': ok({ value: '1.0' }),
      '/client/v4/zones/z2/settings/always_use_https': ok({ value: 'off' }),
      '/client/v4/zones/z2/settings/ssl': ok({ value: 'flexible' }),
      '/client/v4/zones': ok([{ id: 'z1', name: 'acme.com' }, { id: 'z2', name: 'old.acme.com' }]),
    }));
    const out = await cloudflare.run(CREDS, { now: NOW });
    expect(new Set(out.results.map((r) => r.checkKey))).toEqual(new Set(CONNECTOR_BY_KEY.cloudflare.checks.map((c) => c.key)));
    const by = Object.fromEntries(out.results.map((r) => [r.checkKey, r]));
    expect(by['cloudflare.tls_enforced'].status).toBe('fail');
    expect(by['cloudflare.tls_enforced'].summary).toContain('old.acme.com');
    expect(by['cloudflare.tls_enforced'].summary).toMatch(/^1 zone /);
    expect(by['cloudflare.members_mfa'].status).toBe('fail');
    expect(by['cloudflare.members_mfa'].summary).toContain('b@x.co');
    expect(by['cloudflare.members_mfa'].summary).toContain('4 super administrators');
    expect(out.label).toBe('Acme');
  });

  it('marks member two-factor unknown when the field is absent', async () => {
    vi.stubGlobal('fetch', fakeFetch({
      '/client/v4/accounts/acc1/members': ok([member('a', 'a@x.co', undefined, [SUPER]), member('b', 'b@x.co', undefined)]),
      '/client/v4/accounts/acc1': fail(403),
      '/client/v4/zones': ok([]),
    }));
    const out = await cloudflare.run(CREDS, { now: NOW });
    const by = Object.fromEntries(out.results.map((r) => [r.checkKey, r]));
    expect(by['cloudflare.members_mfa'].status).toBe('unknown');
    expect(by['cloudflare.members_mfa'].summary).toContain('1 super administrator');
    expect(by['cloudflare.tls_enforced'].status).toBe('unknown');
    expect(out.label).toBe('acc1');
  });

  it('lists accounts', async () => {
    vi.stubGlobal('fetch', fakeFetch({ '/client/v4/accounts/acc1/members': ok([member('a', 'a@x.co', true, [SUPER]), member('e', 'e@x.co', false, undefined, 'pending')]) }));
    const acc = await cloudflare.accounts!(CREDS, { now: NOW });
    expect(acc).toHaveLength(2);
    expect(acc[0]).toMatchObject({ system: 'Cloudflare', account: 'a@x.co', displayName: 'A X', privilege: SUPER.name, enabled: true, lastActiveAt: null });
    expect(acc[1]).toMatchObject({ account: 'e@x.co', enabled: false });
  });

  it('treats success false as an error', async () => {
    vi.stubGlobal('fetch', fakeFetch({ '/client/v4/accounts/acc1': { success: false, result: null, errors: [{ message: 'Invalid account identifier' }] } }));
    await expect(cloudflare.run(CREDS, { now: NOW })).rejects.toMatchObject({ message: expect.stringContaining('Invalid account identifier') });
  });

  it('says what is wrong with a bad token', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: false, errors: [{ code: 10000, message: 'Authentication error' }] }), { status: 401 })));
    await expect(cloudflare.run(CREDS, { now: NOW })).rejects.toMatchObject({ status: 401, message: expect.stringContaining('Authentication error') });
  });
});
