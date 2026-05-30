import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@aic/auth';
import { MFAService } from '@aic/auth';
import { getTenantDb, users, eq } from '@aic/db';
import QRCode from 'qrcode';

// GET /api/auth/mfa/setup - Generate new MFA secret
export async function GET(_request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const secret = MFAService.generateSecret();
        const otpauth = MFAService.getOTPAuthURI(secret, session.user.email || 'user', 'AIC Platform');
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
        const session = await auth();
        if (!session?.user?.id) {
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

        const db = getTenantDb(session.user.orgId as string);
        await db.query(async (tx) => {
            await tx.update(users)
                .set({
                    twoFactorSecret: secret,
                    twoFactorEnabled: true
                })
                .where(eq(users.id, session.user?.id as string));
        });

        return NextResponse.json({ success: true, message: 'Multi-factor authentication enabled successfully.' });
    } catch (error) {
        console.error('[MFA] Verification Error:', error);
        return NextResponse.json({ error: 'Failed to verify MFA token' }, { status: 500 });
    }
}
