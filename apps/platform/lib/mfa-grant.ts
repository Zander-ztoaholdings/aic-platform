import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';

/**
 * A short-lived grant that unlocks MFA enrolment, and nothing else.
 *
 * THE PROBLEM THIS SOLVES.
 *
 * MFA is mandatory for ADMIN and COMPLIANCE_OFFICER. Every account created
 * through the public signup form is an ADMIN of its own organisation. So every
 * new user is required to have MFA, has none, and `authorize` correctly refuses
 * to issue them a session. The enrolment endpoint requires a session. Nobody
 * who registers can ever log in, and the login page reported it as "Invalid
 * credentials or insufficient permissions" — which was not true and sent people
 * looking for a password problem.
 *
 * The tempting fix is to stop requiring MFA of admins. That is not a fix, it is
 * a downgrade of the policy to work around a missing screen, on a platform
 * whose subject is governance.
 *
 * WHAT THIS IS.
 *
 * Presenting a correct password proves who you are; it just isn't enough to get
 * a session when a second factor is mandatory. It IS enough to be allowed to
 * enrol one. This grant carries exactly that authority: one user id, one
 * purpose, ten minutes.
 *
 * It is deliberately NOT a session. It is not accepted by `auth()`, it carries
 * no role and no organisation, and the only two endpoints that look at it are
 * the two that set up a TOTP secret. Worst case, someone with a stolen password
 * — who could not sign in with it anyway — enrols an authenticator on an
 * account that had none. That is strictly better than the account being
 * permanently unreachable, and no worse than the password alone already allows
 * everywhere MFA is not mandatory.
 *
 * A nonce is included so a grant cannot be replayed once the account is
 * enrolled: both consumers re-check that the user still has no TOTP secret.
 */
const PURPOSE = 'mfa-enrol';
const TTL_MS = 10 * 60 * 1000;

export const MFA_GRANT_COOKIE = 'aic-mfa-enrol';

function secret(): string {
  const s = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error('AUTH_SECRET is not set; cannot sign an MFA enrolment grant');
  return s;
}

const b64 = (b: Buffer) => b.toString('base64url');

export function signMfaGrant(userId: string): string {
  const payload = b64(
    Buffer.from(
      JSON.stringify({ p: PURPOSE, u: userId, x: Date.now() + TTL_MS, n: randomBytes(9).toString('base64url') })
    )
  );
  const sig = b64(createHmac('sha256', secret()).update(payload).digest());
  return `${payload}.${sig}`;
}

/** Returns the user id the grant is for, or null if it is not valid right now. */
export function readMfaGrant(token: string | undefined | null): string | null {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;

  const expected = createHmac('sha256', secret()).update(payload).digest();
  let given: Buffer;
  try {
    given = Buffer.from(sig, 'base64url');
  } catch {
    return null;
  }
  // Length must match before timingSafeEqual, which throws otherwise.
  if (given.length !== expected.length) return null;
  if (!timingSafeEqual(given, expected)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
      p?: string;
      u?: string;
      x?: number;
    };
    if (data.p !== PURPOSE) return null;
    if (typeof data.x !== 'number' || Date.now() > data.x) return null;
    return typeof data.u === 'string' && data.u ? data.u : null;
  } catch {
    return null;
  }
}
