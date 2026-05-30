import { NextRequest, NextResponse } from 'next/server';
import { getSystemDb, users, passwordResetTokens, eq } from '@aic/db';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => null);
        
        if (!body || !body.email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        const email = body.email;
        // [SECURITY] getSystemDb() used for unauthenticated password recovery.
        // User must be looked up by email across the entire system.
        const db = getSystemDb();

        const [user] = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, email.toLowerCase()))
            .limit(1);

        if (!user) {
            // For security, don't reveal if user exists
            return NextResponse.json({ success: true, message: 'If an account exists, a reset link has been sent.' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 3600000); // 1 hour

        await db.transaction(async (tx) => {
            // Task M5: Atomic Token Management
            // Deactivate old tokens for this user
            await tx
                .update(passwordResetTokens)
                .set({ used: true })
                .where(eq(passwordResetTokens.userId, user.id));

            // Insert new token
            await tx.insert(passwordResetTokens).values({
                userId: user.id,
                token,
                expiresAt
            });
        });

        // In production, send real email. For now, log to console.
        const resetLink = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;
        console.log(`[AUTH] Password reset requested for ${email}. Link: ${resetLink}`);

        return NextResponse.json({ 
            success: true, 
            message: 'If an account exists, a reset link has been sent.' 
        });

    } catch (error) {
        console.error('[SECURITY] Forgot Password Failure:', error);
        return NextResponse.json({ error: 'Technical validation failed during recovery' }, { status: 500 });
    }
}
