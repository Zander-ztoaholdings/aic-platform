import { describe, it, expect, vi, afterEach } from 'vitest';
import { bitbucket } from '@/lib/connectors/providers/bitbucket';
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
const CREDS = { workspace: 'acme', email: 'aic@acme.co', token: 't' };
const repo = (slug: string, main: string | null = 'main') => ({ slug, full_name: `acme/${slug}`, mainbranch: main ? { name: main } : null });
const owner = (name: string, permission = 'owner') => ({ permission, user: { display_name: name, nickname: name.toLowerCase() } });

afterEach(() => vi.unstubAllGlobals());

describe('bitbucket connector', () => {
  it('runs every check', async () => {
    vi.stubGlobal('fetch', fakeFetch({
      '/2.0/repositories/acme/api/branch-restrictions': { values: [
        { kind: 'force', branch_match_kind: 'glob', pattern: 'main' },
        { kind: 'require_approvals_to_merge', branch_match_kind: 'glob', pattern: 'main', value: 2 },
      ] },
      '/2.0/repositories/acme/web/branch-restrictions': { values: [{ kind: 'force', branch_match_kind: 'glob', pattern: 'main' }] },
      '/2.0/repositories/acme/app/branch-restrictions': { values: [
        { kind: 'force', branch_match_kind: 'branching_model', branch_type: 'production' },
        { kind: 'require_approvals_to_merge', branch_match_kind: 'branching_model', branch_type: 'production', value: 1 },
      ] },
      '/2.0/repositories/acme/old/branch-restrictions': { values: [{ kind: 'require_approvals_to_merge', branch_match_kind: 'glob', pattern: 'release/*', value: 1 }] },
      '/2.0/repositories/acme?pagelen=100&page=2': { values: [repo('old', 'master')] },
      '/2.0/repositories/acme?pagelen=100': { values: [repo('api'), repo('web'), repo('app'), repo('blank', null)], next: 'https://api.bitbucket.org/2.0/repositories/acme?pagelen=100&page=2' },
      '/2.0/workspaces/acme/permissions': { values: [owner('Ann'), owner('Ben'), owner('Cat'), owner('Dan'), owner('Eve', 'member')] },
    }));
    const out = await bitbucket.run(CREDS, { now: NOW });
    expect(new Set(out.results.map((r) => r.checkKey))).toEqual(new Set(CONNECTOR_BY_KEY.bitbucket.checks.map((c) => c.key)));
    expect(out.results).toHaveLength(CONNECTOR_BY_KEY.bitbucket.checks.length);
    const by = Object.fromEntries(out.results.map((r) => [r.checkKey, r]));
    expect(by['bitbucket.branch_protection'].status).toBe('fail');
    expect(by['bitbucket.branch_protection'].summary).toContain('acme/web (no approval needed)');
    expect(by['bitbucket.branch_protection'].summary).toContain('acme/old (history can be rewritten, no approval needed)');
    expect(by['bitbucket.branch_protection'].summary).not.toContain('acme/api');
    expect(by['bitbucket.branch_protection'].summary).not.toContain('acme/app');
    expect(by['bitbucket.branch_protection'].detail?.repositories).toHaveLength(2);
    expect(by['bitbucket.admins_limited'].status).toBe('fail');
    expect(out.label).toBe('acme');
  });

  it('marks owners unknown when permissions cannot be read', async () => {
    vi.stubGlobal('fetch', fakeFetch({
      '/2.0/repositories/acme/api/branch-restrictions': { values: [
        { kind: 'force', branch_match_kind: 'glob', pattern: 'ma*' },
        { kind: 'require_approvals_to_merge', branch_match_kind: 'glob', pattern: '*', value: 1 },
      ] },
      '/2.0/repositories/acme': { values: [repo('api')] },
    }));
    const out = await bitbucket.run(CREDS, { now: NOW });
    const by = Object.fromEntries(out.results.map((r) => [r.checkKey, r]));
    expect(by['bitbucket.branch_protection'].status).toBe('pass');
    expect(by['bitbucket.admins_limited'].status).toBe('unknown');
  });

  it('lists accounts', async () => {
    vi.stubGlobal('fetch', fakeFetch({ '/2.0/workspaces/acme/permissions': { values: [owner('Ann'), owner('Ben', 'collaborator')] } }));
    const acc = await bitbucket.accounts!(CREDS, { now: NOW });
    expect(acc).toEqual([
      { system: 'Bitbucket Cloud', account: 'ann', displayName: 'Ann', privilege: 'Owner', lastActiveAt: null, enabled: true },
      { system: 'Bitbucket Cloud', account: 'ben', displayName: 'Ben', privilege: 'Collaborator', lastActiveAt: null, enabled: true },
    ]);
  });

  it('says what is wrong with a bad token', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'Invalid credentials' } }), { status: 401 })));
    await expect(bitbucket.run(CREDS, { now: NOW })).rejects.toMatchObject({ status: 401, message: expect.stringContaining('Invalid credentials') });
  });
});
