import { NextRequest, NextResponse } from 'next/server';
import { getSystemDb, users, passwordResetTokens, eq, and, gte } from '@aic/db';

export async function POST(request: NextRequest) {
    try {
        const { token } = await request.json();

        if (!token) {
            return NextResponse.json({ error: 'Verification token is required' }, { status: 400 });
        }

        // [SECURITY] getSystemDb() used for unauthenticated email verification via token.
        const db = getSystemDb();

        const result = await db.transaction(async (tx) => {
            // Task M5: Atomic Verification
            // 1. Find valid token
            const [validToken] = await tx
                .select()
                .from(passwordResetTokens)
                .where(
                    and(
                        eq(passwordResetTokens.token, token),
                        eq(passwordResetTokens.used, false),
                        gte(passwordResetTokens.expiresAt, new Date())
                    )
                )
                .limit(1)
                .for('update');

            if (!validToken) {
                return { error: 'Invalid or expired verification link', status: 400 };
            }

            // 2. Mark email as verified and token as used
            await tx
                .update(users)
                .set({ emailVerified: true })
                .where(eq(users.id, validToken.userId as string));

            await tx
                .update(passwordResetTokens)
                .set({ used: true })
                .where(eq(passwordResetTokens.id, validToken.id));

            return { success: true };
        });

        if ('error' in result) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        return NextResponse.json({ success: true, message: 'Institutional email verified successfully.' });

    } catch (error) {
        console.error('[SECURITY] Email Verification Failure:', error);
        return NextResponse.json({ error: 'Technical validation failed during verification' }, { status: 500 });
    }
}
