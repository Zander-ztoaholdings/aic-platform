import { NextRequest, NextResponse } from 'next/server';
import { getSystemDb, users, passwordResetTokens, eq, and, gte } from '@aic/db';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
    try {
        const { token, password } = await request.json();

        if (!token || !password) {
            return NextResponse.json({ error: 'Token and password are required' }, { status: 400 });
        }

        if (password.length < 12) {
            return NextResponse.json({ error: 'Sovereign-Grade security requires at least 12 characters' }, { status: 400 });
        }

        // [SECURITY] getSystemDb() used for unauthenticated password reset via token.
        const db = getSystemDb();

        // Atomic Transaction: Verify, Update, and Invalidate in one go
        const result = await db.transaction(async (tx) => {
            // 1. Find and validate token (must be unused and not expired)
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
                .for('update'); // Row-level lock to prevent concurrent reset attempts

            if (!validToken) {
                return { error: 'Invalid or expired token', status: 400 };
            }

            // 2. Hash new password (Institutional Standard: Cost Factor 12)
            const salt = await bcrypt.genSalt(12);
            const passwordHash = await bcrypt.hash(password, salt);

            // 3. Update password
            await tx
                .update(users)
                .set({ 
                    passwordHash, 
                    updatedAt: new Date(),
                    emailVerified: true // Implicit verification via reset
                })
                .where(eq(users.id, validToken.userId as string));

            // 4. Mark token as used (Atomic Invalidation)
            await tx
                .update(passwordResetTokens)
                .set({ used: true })
                .where(eq(passwordResetTokens.id, validToken.id));

            return { success: true };
        });

        if ('error' in result) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        return NextResponse.json({ success: true, message: 'Password has been reset successfully.' });

    } catch (error) {
        console.error('[SECURITY] Reset Password Failure:', error);
        return NextResponse.json({ error: 'Technical validation failed during reset' }, { status: 500 });
    }
}
