import { describe, it, expect, vi, afterEach } from 'vitest';
import { aws } from '@/lib/connectors/providers/aws';
import { CONNECTOR_BY_KEY } from '@/lib/connectors/catalog';

type Reply = unknown | { status: number; body: unknown; headers?: Record<string, string> };

/**
 * The okta.test.ts fakeFetch, keyed by host and path because AWS puts several
 * services behind "/". CloudTrail is keyed by its X-Amz-Target operation.
 */
function fakeFetch(routes: Record<string, Reply>) {
  return vi.fn(async (url: string | URL, init?: RequestInit) => {
    const u = new URL(String(url));
    const target = (init?.headers as Record<string, string> | undefined)?.['X-Amz-Target']?.split('.').pop();
    const path = u.host + u.pathname + u.search + (target ? `#${target}` : '');
    const key = Object.keys(routes).find((k) => path.startsWith(k) || path === k);
    if (!key) return new Response(`<Error><Code>NoRoute</Code><Message>no route ${path}</Message></Error>`, { status: 404 });
    const r = routes[key] as { status?: number; body?: unknown; headers?: Record<string, string> };
    const wrapped = r && typeof r === 'object' && 'status' in r && 'body' in r;
    const body = wrapped ? r.body : r;
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: wrapped ? r.status : 200, headers: wrapped ? r.headers ?? {} : {} });
  });
}

const NOW = new Date('2026-10-05T10:00:00Z');
const CREDS = { accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'secret', region: 'af-south-1' };

const HEAD = 'user,arn,user_creation_time,password_enabled,password_last_used,password_last_changed,password_next_rotation,mfa_active,access_key_1_active,access_key_1_last_rotated,access_key_1_last_used_date,access_key_1_last_used_region,access_key_1_last_used_service,access_key_2_active,access_key_2_last_rotated,access_key_2_last_used_date,access_key_2_last_used_region,access_key_2_last_used_service,cert_1_active,cert_1_last_rotated,cert_2_active,cert_2_last_rotated';
const CSV = [
  HEAD,
  '<root_account>,arn:aws:iam::123456789012:root,2020-01-01T00:00:00+00:00,not_supported,2026-09-30T00:00:00+00:00,not_supported,not_supported,true,false,N/A,N/A,N/A,N/A,false,N/A,N/A,N/A,N/A,false,N/A,false,N/A',
  'alice,arn:aws:iam::123456789012:user/alice,2024-01-01T00:00:00+00:00,true,2026-10-01T00:00:00+00:00,2024-01-01T00:00:00+00:00,N/A,true,true,2024-01-01T00:00:00+00:00,2026-10-02T00:00:00+00:00,us-east-1,s3,false,N/A,N/A,N/A,N/A,false,N/A,false,N/A',
  'bob,arn:aws:iam::123456789012:user/bob,2024-01-01T00:00:00+00:00,true,2026-01-01T00:00:00+00:00,2024-01-01T00:00:00+00:00,N/A,false,false,N/A,N/A,N/A,N/A,false,N/A,N/A,N/A,N/A,false,N/A,false,N/A',
  'ci-deploy,arn:aws:iam::123456789012:user/ci-deploy,2023-01-01T00:00:00+00:00,false,N/A,N/A,N/A,false,true,2023-01-01T00:00:00+00:00,N/A,N/A,N/A,false,N/A,N/A,N/A,N/A,false,N/A,false,N/A',
].join('\n');

const base = {
  'sts.amazonaws.com/': '<GetCallerIdentityResponse><GetCallerIdentityResult><Account>123456789012</Account></GetCallerIdentityResult></GetCallerIdentityResponse>',
  'iam.amazonaws.com/?Action=GenerateCredentialReport': '<GenerateCredentialReportResponse><GenerateCredentialReportResult><State>COMPLETE</State></GenerateCredentialReportResult></GenerateCredentialReportResponse>',
  'iam.amazonaws.com/?Action=GetCredentialReport': `<GetCredentialReportResponse><GetCredentialReportResult><Content>${Buffer.from(CSV).toString('base64')}</Content><ReportFormat>text/csv</ReportFormat></GetCredentialReportResult></GetCredentialReportResponse>`,
};

afterEach(() => vi.unstubAllGlobals());

describe('aws connector', () => {
  it('runs every check', async () => {
    const fetch = fakeFetch({
      ...base,
      '123456789012.s3-control.af-south-1.amazonaws.com/v20180820/configuration/publicAccessBlock': { status: 404, body: '<Error><Code>NoSuchPublicAccessBlockConfiguration</Code></Error>' },
      's3.amazonaws.com/': '<ListAllMyBucketsResult><Buckets><Bucket><Name>locked</Name></Bucket><Bucket><Name>open-files</Name></Bucket><Bucket><Name>cape</Name></Bucket></Buckets></ListAllMyBucketsResult>',
      'locked.s3.amazonaws.com/?publicAccessBlock': '<PublicAccessBlockConfiguration><BlockPublicAcls>true</BlockPublicAcls><IgnorePublicAcls>true</IgnorePublicAcls><BlockPublicPolicy>true</BlockPublicPolicy><RestrictPublicBuckets>true</RestrictPublicBuckets></PublicAccessBlockConfiguration>',
      'open-files.s3.amazonaws.com/?publicAccessBlock': { status: 404, body: '<Error><Code>NoSuchPublicAccessBlockConfiguration</Code></Error>' },
      'cape.s3.amazonaws.com/?publicAccessBlock': { status: 301, body: '<Error><Code>PermanentRedirect</Code></Error>', headers: { 'x-amz-bucket-region': 'af-south-1' } },
      'cape.s3.af-south-1.amazonaws.com/?publicAccessBlock': '<PublicAccessBlockConfiguration><BlockPublicAcls>true</BlockPublicAcls><IgnorePublicAcls>true</IgnorePublicAcls><BlockPublicPolicy>true</BlockPublicPolicy><RestrictPublicBuckets>true</RestrictPublicBuckets></PublicAccessBlockConfiguration>',
      'cloudtrail.af-south-1.amazonaws.com/#DescribeTrails': { trailList: [{ Name: 'main', TrailARN: 'arn:aws:cloudtrail:af-south-1:123456789012:trail/main', HomeRegion: 'af-south-1', IsMultiRegionTrail: true, LogFileValidationEnabled: false }] },
      'cloudtrail.af-south-1.amazonaws.com/#GetTrailStatus': { IsLogging: true },
    });
    vi.stubGlobal('fetch', fetch);
    const out = await aws.run(CREDS, { now: NOW });
    const by = Object.fromEntries(out.results.map((r) => [r.checkKey, r]));
    expect(new Set(out.results.map((r) => r.checkKey))).toEqual(new Set(CONNECTOR_BY_KEY.aws.checks.map((c) => c.key)));
    expect(out.results).toHaveLength(CONNECTOR_BY_KEY.aws.checks.length);
    expect(by['aws.iam_users_mfa'].status).toBe('fail');
    expect(by['aws.iam_users_mfa'].summary).toContain('bob');
    expect(by['aws.iam_users_mfa'].summary).not.toContain('alice');
    expect(by['aws.stale_credentials'].status).toBe('fail');
    expect(by['aws.stale_credentials'].summary).toContain('bob password');
    expect(by['aws.stale_credentials'].summary).toContain('ci-deploy access key 1');
    expect(by['aws.stale_credentials'].summary).not.toContain('alice');
    expect(by['aws.s3_public_access_blocked'].status).toBe('fail');
    expect(by['aws.s3_public_access_blocked'].summary).toContain('open-files');
    expect(by['aws.s3_public_access_blocked'].summary).not.toContain('cape');
    expect(by['aws.cloudtrail_enabled'].status).toBe('warn');
    expect(out.label).toBe('123456789012');
    // Every request is signed.
    for (const [, init] of fetch.mock.calls) expect(String((init?.headers as Record<string, string>).Authorization)).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\//);
  });

  it('passes when the account blocks public access and a trail logs everywhere', async () => {
    vi.stubGlobal('fetch', fakeFetch({
      ...base,
      '123456789012.s3-control.af-south-1.amazonaws.com/v20180820/configuration/publicAccessBlock': '<PublicAccessBlockConfiguration><BlockPublicAcls>true</BlockPublicAcls><IgnorePublicAcls>true</IgnorePublicAcls><BlockPublicPolicy>true</BlockPublicPolicy><RestrictPublicBuckets>true</RestrictPublicBuckets></PublicAccessBlockConfiguration>',
      'cloudtrail.af-south-1.amazonaws.com/#DescribeTrails': { trailList: [{ Name: 'org', TrailARN: 'arn:x', HomeRegion: 'af-south-1', IsMultiRegionTrail: true, LogFileValidationEnabled: true }] },
      'cloudtrail.af-south-1.amazonaws.com/#GetTrailStatus': { IsLogging: true },
    }));
    const out = await aws.run(CREDS, { now: NOW });
    const by = Object.fromEntries(out.results.map((r) => [r.checkKey, r]));
    expect(by['aws.s3_public_access_blocked'].status).toBe('pass');
    expect(by['aws.cloudtrail_enabled'].status).toBe('pass');
  });

  it('marks checks it cannot read as unknown', async () => {
    vi.stubGlobal('fetch', fakeFetch({
      'sts.amazonaws.com/': base['sts.amazonaws.com/'],
      'iam.amazonaws.com/': { status: 403, body: '<ErrorResponse><Error><Code>AccessDenied</Code><Message>not allowed</Message></Error></ErrorResponse>' },
      '123456789012.s3-control': { status: 403, body: '<Error><Code>AccessDenied</Code></Error>' },
      'cloudtrail.af-south-1.amazonaws.com/#DescribeTrails': { trailList: [] },
    }));
    const out = await aws.run(CREDS, { now: NOW });
    const by = Object.fromEntries(out.results.map((r) => [r.checkKey, r]));
    expect(by['aws.iam_users_mfa'].status).toBe('unknown');
    expect(by['aws.stale_credentials'].status).toBe('unknown');
    expect(by['aws.s3_public_access_blocked'].status).toBe('unknown');
    expect(by['aws.cloudtrail_enabled'].status).toBe('fail');
  });

  it('lists IAM users as accounts', async () => {
    vi.stubGlobal('fetch', fakeFetch(base));
    const acc = await aws.accounts!(CREDS, { now: NOW });
    expect(acc.map((a) => a.account)).toEqual(['alice', 'bob', 'ci-deploy']);
    expect(acc[0]).toMatchObject({ system: 'AWS', privilege: null, enabled: true, lastActiveAt: '2026-10-02T00:00:00+00:00' });
    expect(acc[2]).toMatchObject({ enabled: true, lastActiveAt: null });
  });

  it('says what is wrong with a bad key', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<ErrorResponse><Error><Code>InvalidClientTokenId</Code><Message>The security token included in the request is invalid.</Message></Error></ErrorResponse>', { status: 403 })));
    await expect(aws.run(CREDS, { now: NOW })).rejects.toMatchObject({ status: 401, message: expect.stringContaining('security token included in the request is invalid') });
  });
});
