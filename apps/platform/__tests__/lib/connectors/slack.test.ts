import { describe, it, expect, vi, afterEach } from 'vitest';
import { slack } from '@/lib/connectors/providers/slack';
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
const m = (id: string, real: string, extra: Record<string, unknown> = {}) => ({ id, name: real.toLowerCase(), real_name: real, deleted: false, is_bot: false, profile: { email: `${real.toLowerCase()}@Acme.co` }, ...extra });
const team = { ok: true, team: { name: 'Acme', domain: 'acme' } };

afterEach(() => vi.unstubAllGlobals());

describe('slack connector', () => {
  it('runs every check', async () => {
    vi.stubGlobal('fetch', fakeFetch({
      '/api/users.list?limit=200&cursor=p2': { ok: true, members: [m('U4', 'Dee', { has_2fa: true, is_admin: true }), m('U5', 'Eve', { has_2fa: true, is_admin: true }), m('U6', 'Fay', { has_2fa: true, is_owner: true, is_admin: true }), m('U7', 'Gus', { has_2fa: false, deleted: true, is_admin: true })], response_metadata: { next_cursor: '' } },
      '/api/users.list': { ok: true, members: [m('U1', 'Ann', { has_2fa: true, is_admin: true }), m('U2', 'Bob', { has_2fa: false, is_admin: true }), m('U3', 'Cat', { has_2fa: true, is_primary_owner: true, is_owner: true }), { id: 'USLACKBOT', name: 'slackbot', is_bot: false, deleted: false }, m('B1', 'Bot', { is_bot: true, is_admin: true })], response_metadata: { next_cursor: 'p2' } },
      '/api/team.info': team,
    }));
    const out = await slack.run({ token: 'xoxp-1' }, { now: NOW });
    expect(new Set(out.results.map((r) => r.checkKey))).toEqual(new Set(CONNECTOR_BY_KEY.slack.checks.map((c) => c.key)));
    const by = Object.fromEntries(out.results.map((r) => [r.checkKey, r]));
    expect(by['slack.mfa_enabled'].status).toBe('fail');
    expect(by['slack.mfa_enabled'].summary).toContain('Bob');
    expect(by['slack.mfa_enabled'].summary).not.toContain('Gus');
    expect(by['slack.admins_limited'].status).toBe('fail');
    expect(by['slack.admins_limited'].summary).toContain('6');
    expect(out.label).toBe('Acme');
    expect(by['slack.mfa_enabled'].subject).toBe('acme.slack.com');
  });

  it('says two-factor status is unknown when Slack hides it', async () => {
    vi.stubGlobal('fetch', fakeFetch({
      '/api/users.list': { ok: true, members: [m('U1', 'Ann', { is_admin: true }), m('U2', 'Bob', { is_owner: true })] },
      '/api/team.info': { ok: false, error: 'missing_scope' },
    }));
    const out = await slack.run({ token: 'xoxp-1' }, { now: NOW });
    const by = Object.fromEntries(out.results.map((r) => [r.checkKey, r]));
    expect(by['slack.mfa_enabled'].status).toBe('unknown');
    expect(by['slack.admins_limited'].status).toBe('pass');
    expect(out.label).toBe('Slack');
  });

  it('lists accounts', async () => {
    vi.stubGlobal('fetch', fakeFetch({ '/api/users.list': { ok: true, members: [m('U1', 'Ann', { is_primary_owner: true, is_owner: true }), m('U2', 'Bob', { is_restricted: true }), m('U3', 'Cat', { deleted: true }), m('B1', 'Bot', { is_bot: true })] } }));
    const acc = await slack.accounts!({ token: 'xoxp-1' }, { now: NOW });
    expect(acc).toHaveLength(3);
    expect(acc[0]).toMatchObject({ system: 'Slack', account: 'ann@acme.co', displayName: 'Ann', privilege: 'Primary owner', enabled: true, lastActiveAt: null });
    expect(acc[1].privilege).toBe('Guest');
    expect(acc[2]).toMatchObject({ privilege: 'Member', enabled: false });
  });

  it('says what is wrong with a bad token', async () => {
    vi.stubGlobal('fetch', fakeFetch({ '/api/users.list': { ok: false, error: 'invalid_auth' } }));
    await expect(slack.run({ token: 'bad' }, { now: NOW })).rejects.toMatchObject({ status: 401, message: expect.stringContaining('invalid_auth') });
  });
});
