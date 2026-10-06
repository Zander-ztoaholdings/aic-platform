import { describe, it, expect, vi, afterEach } from 'vitest';
import { gitlab } from '@/lib/connectors/providers/gitlab';
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
const CREDS = { group: 'acme', token: 't' };
const member = (id: number, username: string, access_level: number, extra: Record<string, unknown> = {}) => ({ id, username, name: username.toUpperCase(), state: 'active', access_level, ...extra });

afterEach(() => vi.unstubAllGlobals());

describe('gitlab connector', () => {
  it('runs every check', async () => {
    vi.stubGlobal('fetch', fakeFetch({
      '/api/v4/groups/acme/projects': [
        { id: 1, path_with_namespace: 'acme/api', default_branch: 'main' },
        { id: 2, path_with_namespace: 'acme/web', default_branch: 'main' },
        { id: 3, path_with_namespace: 'acme/docs', default_branch: 'master' },
        { id: 4, path_with_namespace: 'acme/tools', default_branch: 'main' },
        { id: 5, path_with_namespace: 'acme/empty', default_branch: null, empty_repo: true },
      ],
      '/api/v4/groups/acme/members/all': [
        member(1, 'ann', 50), member(2, 'ben', 50), member(3, 'cat', 40),
        member(4, 'group_9_bot_ab12', 50, { bot: true }), member(5, 'dan', 50, { state: 'blocked' }),
      ],
      '/api/v4/groups/acme': { id: 9, name: 'Acme', full_path: 'acme', require_two_factor_authentication: false },
      '/api/v4/projects/1/protected_branches': [{ name: 'main', allow_force_push: false, push_access_levels: [{ access_level: 40 }] }],
      '/api/v4/projects/2/protected_branches': [{ name: 'main', allow_force_push: true, push_access_levels: [{ access_level: 40 }] }],
      '/api/v4/projects/3/protected_branches': [],
      '/api/v4/projects/4/protected_branches': [{ name: 'ma*', allow_force_push: false, push_access_levels: [{ access_level: 30 }] }],
    }));
    const out = await gitlab.run(CREDS, { now: NOW });
    expect(new Set(out.results.map((r) => r.checkKey))).toEqual(new Set(CONNECTOR_BY_KEY.gitlab.checks.map((c) => c.key)));
    expect(out.results).toHaveLength(CONNECTOR_BY_KEY.gitlab.checks.length);
    const by = Object.fromEntries(out.results.map((r) => [r.checkKey, r]));
    expect(by['gitlab.branch_protection'].status).toBe('fail');
    expect(by['gitlab.branch_protection'].summary).toContain('acme/web (force push allowed)');
    expect(by['gitlab.branch_protection'].summary).toContain('acme/docs (not protected)');
    expect(by['gitlab.branch_protection'].summary).toContain('acme/tools (developers can push)');
    expect(by['gitlab.branch_protection'].summary).not.toContain('acme/api');
    expect(by['gitlab.mfa_required'].status).toBe('fail');
    expect(by['gitlab.admins_limited'].status).toBe('pass');
    expect(by['gitlab.admins_limited'].detail).toEqual({ admins: ['ANN', 'BEN'] });
    expect(out.label).toBe('Acme');
  });

  it('passes when every default branch is protected and two-factor is required', async () => {
    vi.stubGlobal('fetch', fakeFetch({
      '/api/v4/groups/acme/projects': [{ id: 1, path_with_namespace: 'acme/api', default_branch: 'main' }],
      '/api/v4/groups/acme/members/all': [member(1, 'ann', 50)],
      '/api/v4/groups/acme': { id: 9, name: 'Acme', full_path: 'acme', require_two_factor_authentication: true },
      '/api/v4/projects/1/protected_branches': [{ name: 'main', allow_force_push: false, push_access_levels: [{ access_level: 40 }] }],
    }));
    const out = await gitlab.run(CREDS, { now: NOW });
    const by = Object.fromEntries(out.results.map((r) => [r.checkKey, r]));
    expect(by['gitlab.branch_protection'].status).toBe('pass');
    expect(by['gitlab.mfa_required'].status).toBe('pass');
    expect(by['gitlab.admins_limited'].status).toBe('warn');
  });

  it('lists accounts', async () => {
    vi.stubGlobal('fetch', fakeFetch({
      '/api/v4/groups/acme/members/all': [member(1, 'ann', 50, { last_activity_on: '2026-09-30' }), member(2, 'ben', 30, { state: 'blocked' }), member(3, 'project_1_bot', 40)],
    }));
    const acc = await gitlab.accounts!(CREDS, { now: NOW });
    expect(acc).toHaveLength(2);
    expect(acc[0]).toMatchObject({ system: 'GitLab', account: 'ann', displayName: 'ANN', privilege: 'Owner', lastActiveAt: '2026-09-30', enabled: true });
    expect(acc[1]).toMatchObject({ account: 'ben', privilege: 'Developer', enabled: false });
  });

  it('says what is wrong with a bad token', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: '401 Unauthorized' }), { status: 401 })));
    await expect(gitlab.run({ group: 'acme', token: 'bad' }, { now: NOW })).rejects.toMatchObject({ status: 401, message: expect.stringContaining('401 Unauthorized') });
  });
});
