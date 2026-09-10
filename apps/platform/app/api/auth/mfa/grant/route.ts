import { NextResponse } from 'next/server';
import { getSystemDb, users, eq } from '@aic/db';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';
import { signMfaGrant, MFA_GRANT_COOKIE } from '@/lib/mfa-grant';

/**
 * Issues an MFA enrolment grant to someone who has proved their password but
 * cannot be given a session until they have a second factor.
 *
 * The password is verified here rather than trusted from the login attempt that
 * preceded it: this route is reachable on its own, so it has to stand on its
 * own. It answers identically whether or not enrolment is actually required, so
 * it cannot be used to enumerate which addresses belong to privileged accounts.
 */
export async function POST(request: Request) {
  const ip = getClientIP(request);
  /**
   * Budgets, and why the first one was wrong.
   *
   * This started at five per IP per fifteen minutes, on the reasoning that it
   * checks a password and should therefore cost what a login costs. That
   * reasoning ignored where it sits: the login form calls this on EVERY failed
   * sign-in, and a user who cannot get in retries. So the fifth attempt
   * exhausted the budget, the probe began returning 429, the page fell back to
   * "Invalid credentials", and the enrolment redirect — the entire escape
   * hatch — switched itself off for exactly the person who needed it, at
   * exactly the moment they needed it. Rate-limiting the fire exit.
   *
   * The per-IP budget is now generous enough for real use. The protection that
   * actually matters is per-account and bounded near the login lockout
   * threshold, so this cannot be used to guess one account's password faster
   * than the login form allows, from any number of addresses.
   */
  const perIp = checkRateLimit(`mfa-grant-ip:${ip}`, 30, 15 * 60 * 1000);
  if (!perIp.allowed) {
    return NextResponse.json({ throttled: true }, { status: 429 });
  }

  // Deliberately identical for every failure mode below.
  const refuse = () =>
    NextResponse.json({ enrolmentRequired: false }, { status: 200 });

  try {
    const { email, password } = (await request.json()) as {
      email?: string;
      password?: string;
    };
    if (!email || !password) return refuse();

    const perAccount = checkRateLimit(
      `mfa-grant-acct:${email.toLowerCase()}`,
      10,
      15 * 60 * 1000
    );
    if (!perAccount.allowed) {
      return NextResponse.json({ throttled: true }, { status: 429 });
    }

    const db = getSystemDb();
    const [user] = await db
      .select({
        id: users.id,
        passwordHash: users.passwordHash,
        role: users.role,
        isActive: users.isActive,
        isSuperAdmin: users.isSuperAdmin,
        lockoutUntil: users.lockoutUntil,
        twoFactorEnabled: users.twoFactorEnabled,
        twoFactorSecret: users.twoFactorSecret,
      })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (!user || !user.isActive || !user.passwordHash) return refuse();

    const bcrypt = await import('bcryptjs');
    if (!(await bcrypt.default.compare(password, user.passwordHash))) return refuse();

    /**
     * Lockout is checked AFTER the password, and reported.
     *
     * `authorize` throws a perfectly good "Account locked. Try again in N
     * minutes" — and Auth.js v5 collapses it, along with everything else, into
     * "CredentialsSignin". So a locked account reached the login form as
     * "Invalid credentials or insufficient permissions", which is the one
     * message guaranteed to send someone to reset a password that was never
     * wrong. That is what happens when you lock yourself out testing a login.
     *
     * Saying so leaks nothing: only a caller who has just presented the correct
     * password is told, and they can already tell a locked account from a wrong
     * password by the fact that the password is right.
     */
    if (user.lockoutUntil && new Date(user.lockoutUntil) > new Date()) {
      const minutes = Math.max(
        1,
        Math.ceil((new Date(user.lockoutUntil).getTime() - Date.now()) / 60000)
      );
      return NextResponse.json(
        { enrolmentRequired: false, locked: true, minutes },
        { status: 200 }
      );
    }

    // Only the exact situation this exists for: mandatory MFA, none enrolled.
    // Someone already enrolled has a working login and needs nothing from here.
    const mandatory =
      (user.role === 'ADMIN' || user.role === 'COMPLIANCE_OFFICER') && !user.isSuperAdmin;
    if (!mandatory || (user.twoFactorEnabled && user.twoFactorSecret)) return refuse();

    console.log('[MFA] enrolment grant issued for', email.toLowerCase());
    const response = NextResponse.json({ enrolmentRequired: true }, { status: 200 });
    response.cookies.set(MFA_GRANT_COOKIE, signMfaGrant(user.id), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 600,
    });
    return response;
  } catch (error) {
    console.error('[MFA] Grant error:', error);
    return refuse();
  }
}
