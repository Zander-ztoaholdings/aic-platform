import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateKeyPairSync } from 'crypto';
import { gcp } from '@/lib/connectors/providers/gcp';
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
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
const SA = JSON.stringify({ type: 'service_account', project_id: 'acme-prod', client_email: 'aic@acme-prod.iam.gserviceaccount.com', private_key: privateKey });

afterEach(() => vi.unstubAllGlobals());

describe('gcp connector', () => {
  it('runs every check', async () => {
    vi.stubGlobal('fetch', fakeFetch({
      '/token': { access_token: 'ya29.x' },
      '/v3/projects/acme-prod:getIamPolicy': {
        bindings: [
          { role: 'roles/owner', members: ['user:a@acme.co.za', 'user:b@acme.co.za', 'user:c@acme.co.za', 'user:d@acme.co.za'] },
          { role: 'roles/editor', members: ['user:e@acme.co.za', 'user:contractor@gmail.com', 'serviceAccount:x@acme-prod.iam.gserviceaccount.com'] },
        ],
        auditConfigs: [{ service: 'allServices', auditLogConfigs: [{ logType: 'ADMIN_READ' }, { logType: 'DATA_WRITE' }] }],
      },
      '/storage/v1/b?project=acme-prod': { items: [{ name: 'safe', iamConfiguration: { publicAccessPrevention: 'enforced' } }, { name: 'website', iamConfiguration: { publicAccessPrevention: 'inherited' } }, { name: 'internal', iamConfiguration: { publicAccessPrevention: 'inherited' } }] },
      '/storage/v1/b/website/iam': { bindings: [{ role: 'roles/storage.objectViewer', members: ['allUsers'] }] },
      '/storage/v1/b/internal/iam': { bindings: [{ role: 'roles/storage.admin', members: ['user:a@acme.co.za'] }] },
    }));
    const out = await gcp.run({ serviceAccount: SA }, { now: NOW });
    const by = Object.fromEntries(out.results.map((r) => [r.checkKey, r]));
    expect(new Set(out.results.map((r) => r.checkKey))).toEqual(new Set(CONNECTOR_BY_KEY.gcp.checks.map((c) => c.key)));
    expect(out.results).toHaveLength(CONNECTOR_BY_KEY.gcp.checks.length);
    expect(by['gcp.owners_limited'].status).toBe('fail');
    expect(by['gcp.owners_limited'].summary).toContain('contractor@gmail.com');
    expect(by['gcp.owners_limited'].summary).not.toContain('e@acme.co.za');
    expect(by['gcp.gcs_public_access_prevented'].status).toBe('fail');
    expect(by['gcp.gcs_public_access_prevented'].summary).toContain('website');
    expect(by['gcp.gcs_public_access_prevented'].summary).not.toContain('internal');
    expect(by['gcp.audit_logging'].status).toBe('fail');
    expect(by['gcp.audit_logging'].summary).toContain('Data Read');
    expect(out.label).toBe('acme-prod');
  });

  it('passes a tidy project, using the project id given', async () => {
    vi.stubGlobal('fetch', fakeFetch({
      '/token': { access_token: 'ya29.x' },
      '/v3/projects/other:getIamPolicy': {
        bindings: [{ role: 'roles/owner', members: ['user:a@acme.co.za', 'user:b@acme.co.za'] }],
        auditConfigs: [{ service: 'allServices', auditLogConfigs: [{ logType: 'DATA_READ' }, { logType: 'DATA_WRITE' }] }],
      },
      '/storage/v1/b?project=other': { items: [{ name: 'safe', iamConfiguration: { publicAccessPrevention: 'enforced' } }] },
    }));
    const out = await gcp.run({ serviceAccount: SA, projectId: 'other' }, { now: NOW });
    expect(out.results.map((r) => r.status)).toEqual(['pass', 'pass', 'pass']);
  });

  it('marks the policy checks unknown when the policy cannot be read', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => {
      const p = new URL(String(url)).pathname;
      if (p === '/token') return new Response(JSON.stringify({ access_token: 't' }));
      if (p.includes('getIamPolicy')) return new Response(JSON.stringify({ error: { message: 'Permission denied' } }), { status: 403 });
      return new Response(JSON.stringify({ items: [] }));
    }));
    const out = await gcp.run({ serviceAccount: SA }, { now: NOW });
    const by = Object.fromEntries(out.results.map((r) => [r.checkKey, r]));
    expect(by['gcp.owners_limited'].status).toBe('unknown');
    expect(by['gcp.audit_logging'].status).toBe('unknown');
    expect(by['gcp.gcs_public_access_prevented'].status).toBe('pass');
  });

  it('says what is wrong with a bad key', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid JWT Signature.' }), { status: 401 })));
    await expect(gcp.run({ serviceAccount: SA }, { now: NOW })).rejects.toMatchObject({ status: 401, message: expect.stringContaining('Invalid JWT Signature') });
  });
});
