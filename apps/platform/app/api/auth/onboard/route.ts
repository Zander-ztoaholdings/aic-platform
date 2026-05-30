import { NextResponse } from 'next/server';
import { getSystemDb, users, inviteCodes, eq, sql, and } from '@aic/db';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

const OnboardSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  inviteCode: z.string(),
  orgId: z.string().uuid().optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = OnboardSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.format() }, { status: 400 });
    }

    const { name, email, password, inviteCode } = validation.data;
    const db = getSystemDb();

    // 1. Verify Invite Code
    const [invite] = await db.select().from(inviteCodes)
        .where(and(
            eq(inviteCodes.code, inviteCode),
            sql`${inviteCodes.uses} < ${inviteCodes.maxUses}`
        ))
        .limit(1);

    if (!invite) {
        // Prototype Fallback: Allow "ALPHA2026" for testing
        if (inviteCode !== 'ALPHA2026') {
            return NextResponse.json({ error: 'Invalid or expired invite code' }, { status: 403 });
        }
    }

    // 2. Check for existing user
    const [existing] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    if (existing) {
        return NextResponse.json({ error: 'Account already exists' }, { status: 409 });
    }

    // 3. Create User & Update Invite in Transaction
    const hash = await bcrypt.hash(password, 12);
    
    const result = await db.transaction(async (tx) => {
        const [newUser] = await tx.insert(users).values({
            name,
            email: email.toLowerCase(),
            passwordHash: hash,
            orgId: invite?.orgId || null, // Auto-link to org if invite has it
            role: invite?.role || 'ADMIN',
            isActive: true,
            emailVerified: true
        }).returning({ id: users.id });

        if (invite) {
            await tx.update(inviteCodes)
                .set({ uses: sql`${inviteCodes.uses} + 1` })
                .where(eq(inviteCodes.id, invite.id));
        }

        return newUser;
    });

    return NextResponse.json({ success: true, userId: result.id });

  } catch (error) {
    console.error('[ONBOARD_API_ERROR]', error);
    return NextResponse.json({ error: 'Internal system failure' }, { status: 500 });
  }
}
