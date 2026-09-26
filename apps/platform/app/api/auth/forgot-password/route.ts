import { NextRequest, NextResponse } from 'next/server';
import { getSystemDb, users, eq } from '@aic/db';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';
import { issueToken, TOKEN_TTL } from '@/lib/auth-tokens';
import { sendEmail } from '@/lib/email';
import { appUrl } from '@/lib/app-url';

const GENERIC = 'If an account exists for that address, a reset link is on its way.';

/**
 * Request a password reset. The answer is the same whether or not the account
 * exists, so this cannot be used to find out who has one.
 *
 * Previously the link was written to the server log and never sent — the page
 * told people to check their inbox for an email that did not exist.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request);
    if (!checkRateLimit(`forgot:${ip}`, 5, 15 * 60_000).allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    if (!checkRateLimit(`forgot-email:${email}`, 3, 60 * 60_000).allowed) {
      return NextResponse.json({ success: true, message: GENERIC });
    }

    // Unauthenticated by nature: the account is found by email across the system.
    const [user] = await getSystemDb()
      .select({ id: users.id, name: users.name, isActive: users.isActive })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (user) {
      const token = await issueToken(user.id, TOKEN_TTL.reset);
      await sendEmail({
        to: email,
        subject: 'Reset your AIC password',
        paragraphs: [
          `Hello${user.name ? ` ${user.name.split(' ')[0]}` : ''},`,
          'Someone — hopefully you — asked to reset the password for your AIC account. The link below works once and expires in an hour.',
        ],
        action: { label: 'Choose a new password', url: `${appUrl()}/reset-password?token=${token}` },
        footnote: 'If you did not ask for this, you can ignore this email; your password has not changed.',
      });
    }

    return NextResponse.json({ success: true, message: GENERIC });
  } catch (error) {
    console.error('[SECURITY] Forgot Password Failure:', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
