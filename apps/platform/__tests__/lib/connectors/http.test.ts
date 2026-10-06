import { describe, it, expect } from 'vitest';
import { signAws, parseCsv, providerMessage, adminsCheck, staleCheck, baseUrl } from '@/lib/connectors/http';

describe('signAws', () => {
  it('matches the AWS Signature Version 4 example from the AWS documentation', () => {
    // docs.aws.amazon.com/IAM/latest/UserGuide/create-signed-request.html (IAM ListUsers example)
    const h = signAws({
      method: 'GET', url: 'https://iam.amazonaws.com/?Action=ListUsers&Version=2010-05-08', region: 'us-east-1', service: 'iam',
      headers: { 'content-type': 'application/x-www-form-urlencoded; charset=utf-8' },
      accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY', now: new Date('2015-08-30T12:36:00Z'),
    });
    expect(h.Authorization).toBe('AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/iam/aws4_request, SignedHeaders=content-type;host;x-amz-date, Signature=5d672d79c15b13162d9279b0855cfba6789a8edb4c82c400e06b5924a6f2b5d7');
  });
});

describe('helpers', () => {
  it('reads a credential report CSV', () => {
    const rows = parseCsv('user,mfa_active\n<root_account>,true\n"a,b",false\n');
    expect(rows).toEqual([{ user: '<root_account>', mfa_active: 'true' }, { user: 'a,b', mfa_active: 'false' }]);
  });
  it('finds the message in an error body', () => {
    expect(providerMessage('{"errors":[{"message":"Bad token"}]}')).toBe('Bad token');
    expect(providerMessage('{"errorSummary":"Invalid token provided"}')).toBe('Invalid token provided');
    expect(providerMessage('<html><b>Forbidden</b></html>')).toBe('Forbidden');
  });
  it('counts admins', () => {
    expect(adminsCheck('x', 's', ['a', 'b'], 'admins').status).toBe('pass');
    expect(adminsCheck('x', 's', ['a', 'b', 'c', 'd'], 'admins').status).toBe('fail');
    expect(adminsCheck('x', 's', ['a'], 'admins').status).toBe('warn');
  });
  it('finds stale accounts, ignoring new ones', () => {
    const now = new Date('2026-10-05T00:00:00Z');
    const r = staleCheck('x', 's', [
      { name: 'old', lastActive: '2026-01-01', created: '2025-01-01' },
      { name: 'new', lastActive: null, created: '2026-09-30' },
      { name: 'fine', lastActive: '2026-10-01', created: '2025-01-01' },
    ], now);
    expect(r.status).toBe('fail');
    expect(r.summary).toContain('old');
    expect(r.summary).not.toContain('new');
  });
  it('accepts only https addresses', () => {
    expect(baseUrl('acme.okta.com/')).toBe('https://acme.okta.com');
    expect(() => baseUrl('http://acme.okta.com')).toThrow();
  });
  it('refuses private network addresses', async () => {
    const { isPrivateHost } = await import('@/lib/connectors/http');
    for (const h of ['localhost', '10.1.2.3', '169.254.169.254', '192.168.0.1', '172.20.0.1', '::1', 'metadata.google.internal', 'intranet']) expect(isPrivateHost(h), h).toBe(true);
    for (const h of ['acme.okta.com', '8.8.8.8', 'gitlab.example.co.za']) expect(isPrivateHost(h), h).toBe(false);
  });
});
