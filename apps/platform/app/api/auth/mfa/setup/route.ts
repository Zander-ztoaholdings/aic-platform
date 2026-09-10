import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@aic/auth';
import { MFAService } from '@aic/auth';
import { getTenantDb, getSystemDb, users, eq } from '@aic/db';
import QRCode from 'qrcode';
import { readMfaGrant, MFA_GRANT_COOKIE } from '@/lib/mfa-grant';

/**
 * Who is allowed to set up a second factor.
 *
 * A session, as before — someone already signed in adding MFA voluntarily. Or
 * an enrolment grant, for the case a session is impossible until MFA exists:
 * mandatory for the role, not yet enrolled. See lib/mfa-grant.ts.
 *
 * The grant is re-checked against the database on every call rather than
 * trusted for its full ten minutes, so it stops working the moment a secret is
 * actually set — a grant cannot be replayed to overwrite an authenticator
 * somebody has already enrolled.
 */
async function enroller(): Promise<
  { userId: string; email: string; orgId: string | null } | null
> {
  const session = await auth();
  if (session?.user?.id) {
    return {
      userId: session.user.id,
      email: session.user.email || 'user',
      orgId: (session.user.orgId as string) ?? null,
    };
  }

  const jar = await cookies();
  const userId = readMfaGrant(jar.get(MFA_GRANT_COOKIE)?.value);
  if (!userId) return null;

  const db = getSystemDb();
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      orgId: users.orgId,
      isActive: users.isActive,
      twoFactorEnabled: users.twoFactorEnabled,
      twoFactorSecret: users.twoFactorSecret,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || !user.isActive) return null;
  if (user.twoFactorEnabled && user.twoFactorSecret) return null;
  return { userId: user.id, email: user.email, orgId: user.orgId };
}

// GET /api/auth/mfa/setup - Generate new MFA secret
export async function GET(_request: NextRequest) {
    try {
        const who = await enroller();
        if (!who) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const secret = MFAService.generateSecret();
        const otpauth = MFAService.getOTPAuthURI(secret, who.email, 'AIC Platform');
        const qrCodeDataUrl = await QRCode.toDataURL(otpauth);

        return NextResponse.json({
            secret,
            qrCode: qrCodeDataUrl,
            otpauth
        });
    } catch (error) {
        console.error('[MFA] Setup Error:', error);
        return NextResponse.json({ error: 'Failed to initialize MFA setup' }, { status: 500 });
    }
}

// POST /api/auth/mfa/setup - Verify and enable MFA
export async function POST(request: Request) {
    try {
        const who = await enroller();
        if (!who) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { secret, token } = await request.json();
        if (!secret || !token) {
            return NextResponse.json({ error: 'Secret and token are required' }, { status: 400 });
        }

        const isValid = MFAService.verifyToken(secret, token);
        if (!isValid) {
            return NextResponse.json({ error: 'Invalid verification token' }, { status: 400 });
        }

        const db = getTenantDb(who.orgId as string);
        await db.query(async (tx) => {
            await tx.update(users)
                .set({
                    twoFactorSecret: secret,
                    twoFactorEnabled: true
                })
                .where(eq(users.id, who.userId));
        });

        // The grant has done its one job. Clearing it here rather than leaving
        // it to expire means the ten-minute window is only ever open while
        // enrolment is genuinely outstanding.
        const done = NextResponse.json({ success: true, message: 'Multi-factor authentication enabled successfully.' });
        done.cookies.set(MFA_GRANT_COOKIE, '', { path: '/', maxAge: 0 });
        return done;
    } catch (error) {
        console.error('[MFA] Verification Error:', error);
        return NextResponse.json({ error: 'Failed to verify MFA token' }, { status: 500 });
    }
}
