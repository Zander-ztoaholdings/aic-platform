import { describe, it, expect, vi, afterEach } from 'vitest';
import { onepassword } from '@/lib/connectors/providers/onepassword';
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
const CREDS = { token: 't', region: 'eu' };
const att = (category: string, email: string) => ({ category, target_user: { email } });

afterEach(() => vi.unstubAllGlobals());

describe('onepassword connector', () => {
  it('flags repeated second-factor failures and follows the cursor', async () => {
    const pages = [
      { items: [att('mfa_failed', 'a@x.co'), att('mfa_failed', 'a@x.co'), att('success', 'b@x.co')], cursor: 'c1', has_more: true },
      { items: [att('mfa_failed', 'a@x.co'), att('mfa_failed', 'b@x.co')], cursor: 'c2', has_more: false },
    ];
    const bodies: unknown[] = [];
    const f = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const u = new URL(String(url));
      if (u.pathname === '/api/v2/auth/introspect') return new Response(JSON.stringify({ features: ['signinattempts', 'auditevents'], account_uuid: 'acc' }), { status: 200 });
      bodies.push(JSON.parse(String(init?.body)));
      expect(init?.method).toBe('POST');
      return new Response(JSON.stringify(pages[bodies.length - 1]), { status: 200 });
    });
    vi.stubGlobal('fetch', f);
    const out = await onepassword.run(CREDS, { now: NOW });
    expect(String(f.mock.calls[0][0])).toBe('https://events.1password.eu/api/v2/auth/introspect');
    expect(bodies[0]).toEqual({ limit: 1000, start_time: '2026-09-28T10:00:00.000Z' });
    expect(bodies[1]).toEqual({ cursor: 'c1' });
    expect(new Set(out.results.map((r) => r.checkKey))).toEqual(new Set(CONNECTOR_BY_KEY.onepassword.checks.map((c) => c.key)));
    expect(out.results[0].status).toBe('warn');
    expect(out.results[0].summary).toContain('a@x.co');
    expect(out.results[0].summary).not.toContain('b@x.co');
    expect(out.label).toBe('1Password');
  });

  it('passes with no repeated failures', async () => {
    vi.stubGlobal('fetch', fakeFetch({
      '/api/v2/auth/introspect': { features: ['signinattempts'] },
      '/api/v2/signinattempts': { items: [att('success', 'a@x.co'), att('mfa_failed', 'b@x.co')], has_more: false },
    }));
    const out = await onepassword.run({ token: 't' }, { now: NOW });
    expect(out.results[0].status).toBe('pass');
    expect(out.results[0].summary).toContain('2 sign-in attempts');
  });

  it('fails when the token cannot read sign-in attempts', async () => {
    vi.stubGlobal('fetch', fakeFetch({ '/api/v2/auth/introspect': { features: ['auditevents'] } }));
    const out = await onepassword.run(CREDS, { now: NOW });
    expect(out.results).toHaveLength(1);
    expect(out.results[0]).toMatchObject({ checkKey: 'onepassword.signin_monitoring', status: 'fail' });
  });

  it('says what is wrong with a bad token', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ Error: { Message: 'Unauthorized' }, message: 'Unauthorized' }), { status: 401 })));
    await expect(onepassword.run(CREDS, { now: NOW })).rejects.toMatchObject({ status: 401, message: expect.stringContaining('Unauthorized') });
  });
});
