import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, users, passwordResetTokens, eq } from '@aic/db';
import { auth } from '@aic/auth';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const InviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(['ADMIN', 'COMPLIANCE_OFFICER', 'AUDITOR', 'VIEWER'])
});

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session || !session.user?.orgId || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Only institutional administrators can invite users' }, { status: 403 });
        }

        const orgId = session.user.orgId;
        const body = await request.json();
        const validation = InviteSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: 'Validation failed', details: validation.error.format() }, { status: 400 });
        }

        const { email, name, role } = validation.data;
        const db = getTenantDb(orgId);

        const result = await db.query(async (tx) => {
            // 1. Check if user already exists
            const [existingUser] = await tx
                .select({ id: users.id })
                .from(users)
                .where(eq(users.email, email.toLowerCase()))
                .limit(1);

            if (existingUser) {
                // Return success to mitigate email enumeration, but don't actually send new invite
                // in a real system we would send a 'you are already invited' email.
                return { success: true, alreadyExists: true };
            }

            // 2. Create user with hashed dummy password and is_active = FALSE
            // Standardizing on Institutional Cost Factor 12
            const dummyRaw = crypto.randomBytes(32).toString('hex');
            const salt = await bcrypt.genSalt(12);
            const passwordHash = await bcrypt.hash(dummyRaw, salt);

            const [newUser] = await tx.insert(users).values({
                email: email.toLowerCase(),
                passwordHash,
                name,
                role,
                orgId,
                isActive: false,
                emailVerified: false
            }).returning({ id: users.id });

            // 3. Generate invite/reset token
            const token = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 604800000); // 7 days

            await tx.insert(passwordResetTokens).values({
                userId: newUser.id,
                token,
                expiresAt
            });

            return { success: true, token };
        });

        if (result.alreadyExists) {
            return NextResponse.json({ 
                success: true, 
                message: 'Institutional invitation issued successfully.' 
            });
        }

        const inviteLink = `${process.env.NEXTAUTH_URL}/reset-password?token=${result.token}`;
        console.log(`[AUTH] User invited to ${orgId}: ${email}. Link: ${inviteLink}`);

        return NextResponse.json({ 
            success: true, 
            inviteLink,
            message: 'Institutional invitation issued successfully.' 
        });

    } catch (error) {
        console.error('[SECURITY] Invite User Failure:', error);
        return NextResponse.json({ error: 'Technical validation failed during invitation' }, { status: 500 });
    }
}
