import { describe, it, expect, beforeAll } from 'vitest';
import { createHmac } from 'node:crypto';

process.env.AUTH_SECRET = process.env.AUTH_SECRET || 'test-secret-for-mfa-grant-checks';

import { signMfaGrant, readMfaGrant } from '@/lib/mfa-grant';

/**
 * This grant is the one thing standing between a correct password and the
 * ability to enrol a second factor on an account that has none, so its failure
 * modes matter more than its happy path. Each test below is a way it could be
 * wrong that would not show up in any other check.
 */
describe('MFA enrolment grant', () => {
  let grant: string;
  beforeAll(() => {
    grant = signMfaGrant('user-123');
  });

  it('carries the user it was issued for', () => {
    expect(readMfaGrant(grant)).toBe('user-123');
  });

  it('refuses a tampered payload', () => {
    const [payload, sig] = grant.split('.');
    const forged = Buffer.from(
      JSON.stringify({ p: 'mfa-enrol', u: 'someone-else', x: Date.now() + 60_000, n: 'x' })
    ).toString('base64url');
    expect(readMfaGrant(`${forged}.${sig}`)).toBeNull();
    expect(readMfaGrant(`x${payload}.${sig}`)).toBeNull();
  });

  it('refuses a tampered signature', () => {
    expect(readMfaGrant(`${grant.split('.')[0]}.abcd`)).toBeNull();
  });

  it('refuses anything malformed', () => {
    expect(readMfaGrant('')).toBeNull();
    expect(readMfaGrant(undefined)).toBeNull();
    expect(readMfaGrant(null)).toBeNull();
    expect(readMfaGrant(grant.split('.')[0])).toBeNull();
  });

  it('refuses a grant that has expired', () => {
    const stale = Buffer.from(
      JSON.stringify({ p: 'mfa-enrol', u: 'user-123', x: Date.now() - 1000, n: 'x' })
    ).toString('base64url');
    const sig = createHmac('sha256', process.env.AUTH_SECRET as string)
      .update(stale)
      .digest()
      .toString('base64url');
    expect(readMfaGrant(`${stale}.${sig}`)).toBeNull();
  });

  it('refuses a correctly signed token issued for another purpose', () => {
    // Guards against this ever being accepted as, or minted from, a session
    // token: the signature is genuine and it must still be rejected.
    const other = Buffer.from(
      JSON.stringify({ p: 'session', u: 'user-123', x: Date.now() + 60_000, n: 'x' })
    ).toString('base64url');
    const sig = createHmac('sha256', process.env.AUTH_SECRET as string)
      .update(other)
      .digest()
      .toString('base64url');
    expect(readMfaGrant(`${other}.${sig}`)).toBeNull();
  });

  it('never issues the same grant twice', () => {
    expect(signMfaGrant('u')).not.toBe(signMfaGrant('u'));
  });
});
