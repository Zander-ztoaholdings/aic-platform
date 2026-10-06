import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { azure } from '@/lib/connectors/providers/azure';
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
const OWNER = '/subscriptions/s1/providers/Microsoft.Authorization/roleDefinitions/8e3af657-a8ff-443c-a75c-2fe8c4bcb635';
const owner = (id: string, principalType = 'User') => ({ properties: { roleDefinitionId: OWNER, principalId: id, principalType } });

beforeEach(() => { process.env.MS_CLIENT_ID = 'cid'; process.env.MS_CLIENT_SECRET = 'secret'; });
afterEach(() => vi.unstubAllGlobals());

describe('azure connector', () => {
  it('runs every check across subscriptions', async () => {
    const fetch = fakeFetch({
      '/tenant-1/oauth2/v2.0/token': { access_token: 'arm' },
      '/subscriptions?api-version=2022-12-01': { value: [{ subscriptionId: 's1', displayName: 'Production', state: 'Enabled' }, { subscriptionId: 's2', displayName: 'Dev', state: 'Enabled' }, { subscriptionId: 's3', displayName: 'Old', state: 'Disabled' }] },
      '/subscriptions/s1/providers/Microsoft.Authorization/roleAssignments': { value: [owner('u1'), owner('u2'), owner('u3'), owner('u4'), owner('g1', 'Group')] },
      '/subscriptions/s2/providers/Microsoft.Authorization/roleAssignments': { value: [owner('u1'), owner('u2')], nextLink: 'https://management.azure.com/next/s2-roles' },
      '/next/s2-roles': { value: [owner('u5')] },
      '/subscriptions/s1/providers/Microsoft.Storage/storageAccounts': { value: [{ name: 'prodfiles', properties: { allowBlobPublicAccess: true, supportsHttpsTrafficOnly: true, minimumTlsVersion: 'TLS1_2' } }] },
      '/subscriptions/s2/providers/Microsoft.Storage/storageAccounts': { value: [{ name: 'devlogs', properties: { allowBlobPublicAccess: false, supportsHttpsTrafficOnly: true, minimumTlsVersion: 'TLS1_0' } }, { name: 'devok', properties: { allowBlobPublicAccess: false, supportsHttpsTrafficOnly: true, minimumTlsVersion: 'TLS1_2' } }] },
      '/subscriptions/s1/providers/Microsoft.Insights/diagnosticSettings': { value: [{ name: 'export', properties: { workspaceId: '/ws', logs: [{ category: 'Administrative', enabled: true }] } }] },
      '/subscriptions/s2/providers/Microsoft.Insights/diagnosticSettings': { value: [] },
      '/subscriptions/s1/providers/Microsoft.Security/assessments': { value: [
        { name: 'a1', properties: { displayName: 'MFA should be enabled on accounts with owner permissions', status: { code: 'Unhealthy' }, metadata: { severity: 'High' } } },
        { name: 'a2', properties: { displayName: 'Something minor', status: { code: 'Unhealthy' }, metadata: { severity: 'Low' } } },
      ] },
      '/subscriptions/s2/providers/Microsoft.Security/assessments': { value: [{ name: 'a3', properties: { displayName: 'Storage should use private link', status: { code: 'Unhealthy' } } }] },
      '/providers/Microsoft.Security/assessmentMetadata': { value: [{ name: 'a3', properties: { severity: 'High' } }] },
    });
    vi.stubGlobal('fetch', fetch);
    const out = await azure.run({}, CTX);
    const by = Object.fromEntries(out.results.map((r) => [r.checkKey, r]));
    expect(new Set(out.results.map((r) => r.checkKey))).toEqual(new Set(CONNECTOR_BY_KEY.azure.checks.map((c) => c.key)));
    expect(out.results).toHaveLength(CONNECTOR_BY_KEY.azure.checks.length);
    expect(out.results.every((r) => r.subject === 'Azure')).toBe(true);
    expect(by['azure.owners_limited'].status).toBe('fail');
    expect(by['azure.owners_limited'].summary).toContain('Production (4)');
    expect(by['azure.owners_limited'].summary).not.toContain('Dev');
    expect(by['azure.storage_no_public_access'].status).toBe('fail');
    expect(by['azure.storage_no_public_access'].summary).toContain('prodfiles in Production');
    expect(by['azure.storage_no_public_access'].summary).toContain('devlogs in Dev');
    expect(by['azure.storage_no_public_access'].summary).not.toContain('devok');
    expect(by['azure.activity_log_exported'].status).toBe('fail');
    expect(by['azure.activity_log_exported'].summary).toContain('Dev');
    expect(by['azure.defender_unhealthy_assessments'].status).toBe('fail');
    expect(by['azure.defender_unhealthy_assessments'].summary).toContain('Storage should use private link in Dev');
    expect(by['azure.defender_unhealthy_assessments'].summary).not.toContain('Something minor');
    expect(out.label).toBe('Azure, 2 subscriptions');
    const tokenCall = fetch.mock.calls.find(([u]) => String(u).includes('login.microsoftonline.com')) as unknown as [string, RequestInit];
    expect(String(tokenCall[1].body)).toContain(encodeURIComponent('https://management.azure.com/.default'));
  });

  it('uses the subscriptions given and passes a tidy one', async () => {
    vi.stubGlobal('fetch', fakeFetch({
      '/tenant-1/oauth2/v2.0/token': { access_token: 'arm' },
      '/subscriptions/s9?api-version': { displayName: 'Main' },
      '/subscriptions/s9/providers/Microsoft.Authorization/roleAssignments': { value: [owner('u1'), owner('u2')] },
      '/subscriptions/s9/providers/Microsoft.Storage/storageAccounts': { value: [{ name: 'ok', properties: { allowBlobPublicAccess: false, supportsHttpsTrafficOnly: true, minimumTlsVersion: 'TLS1_2' } }] },
      '/subscriptions/s9/providers/Microsoft.Insights/diagnosticSettings': { value: [{ name: 'x', properties: { storageAccountId: '/sa', logs: [{ categoryGroup: 'allLogs', enabled: true }] } }] },
      '/subscriptions/s9/providers/Microsoft.Security/assessments': { value: [{ name: 'h', properties: { status: { code: 'Healthy' }, metadata: { severity: 'High' } } }] },
    }));
    const out = await azure.run({ subscriptions: 's9\n' }, CTX);
    expect(out.results.map((r) => r.status)).toEqual(['pass', 'pass', 'pass', 'pass']);
    expect(out.label).toBe('Azure Main');
  });

  it('marks a check unknown when Azure refuses it', async () => {
    vi.stubGlobal('fetch', fakeFetch({
      '/tenant-1/oauth2/v2.0/token': { access_token: 'arm' },
      '/subscriptions?api-version=2022-12-01': { value: [{ subscriptionId: 's1', displayName: 'Production', state: 'Enabled' }] },
      '/subscriptions/s1/providers/Microsoft.Authorization/roleAssignments': { value: [owner('u1'), owner('u2')] },
      '/subscriptions/s1/providers/Microsoft.Storage/storageAccounts': { value: [] },
      '/subscriptions/s1/providers/Microsoft.Insights/diagnosticSettings': { value: [] },
    }));
    const out = await azure.run({}, CTX);
    const by = Object.fromEntries(out.results.map((r) => [r.checkKey, r]));
    expect(by['azure.defender_unhealthy_assessments'].status).toBe('unknown');
    expect(by['azure.owners_limited'].status).toBe('pass');
  });

  it('needs Microsoft 365 connected first', async () => {
    await expect(azure.run({}, { now: NOW })).rejects.toMatchObject({ status: 400, message: expect.stringContaining('Connect Microsoft 365 first') });
  });

  it('surfaces a rejected token as a connector error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'invalid_client' }), { status: 401 })));
    await expect(azure.run({}, CTX)).rejects.toMatchObject({ status: 403, message: expect.stringContaining('refused a token') });
    await expect(azure.run({}, CTX)).rejects.toBeInstanceOf((await import('@/lib/connectors/types')).ConnectorError);
  });

  it('surfaces an expired token from Azure Resource Manager', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => String(url).includes('login.microsoftonline.com')
      ? new Response(JSON.stringify({ access_token: 'arm' }))
      : new Response(JSON.stringify({ error: { message: 'The access token is invalid.' } }), { status: 401 })));
    await expect(azure.run({}, CTX)).rejects.toMatchObject({ status: 401, message: expect.stringContaining('access token is invalid') });
  });
});
