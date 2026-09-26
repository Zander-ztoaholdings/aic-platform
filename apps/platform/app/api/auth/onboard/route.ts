import { NextResponse } from 'next/server';
import { getSystemDb, users, inviteCodes, organizations, eq, sql, and } from '@aic/db';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

const OnboardSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(12),
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
            sql`${inviteCodes.uses} < ${inviteCodes.maxUses}`,
            // The code's own expiry was stored and never checked.
            sql`(${inviteCodes.expiresAt} IS NULL OR ${inviteCodes.expiresAt} > now())`
        ))
        .limit(1);

    // A shared literal invite code ('ALPHA2026') used to be accepted here as a
    // "prototype fallback", which meant anybody who read it in the public
    // repository could mint an ORG_ADMIN account on any deployment. An invite
    // must now exist, be unexhausted, and be looked up — there is no bypass.
    if (!invite) {
        return NextResponse.json({ error: 'Invalid or expired invite code' }, { status: 403 });
    }

    // 2. Check for existing user
    const [existing] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    if (existing) {
        return NextResponse.json({ error: 'Account already exists' }, { status: 409 });
    }

    // The code was emailed to the organisation's contact address. Only that
    // address counts as verified by using it — anyone holding the link could
    // otherwise register a different address and have it marked verified.
    let contactEmail: string | null = null;
    if (invite.orgId) {
        const [org] = await db.select({ contactEmail: organizations.contactEmail }).from(organizations).where(eq(organizations.id, invite.orgId)).limit(1);
        contactEmail = org?.contactEmail?.toLowerCase() ?? null;
    }
    const verified = !!contactEmail && contactEmail === email.toLowerCase();

    // 3. Create User & Update Invite in Transaction
    const hash = await bcrypt.hash(password, 12);
    
    const result = await db.transaction(async (tx) => {
        const [newUser] = await tx.insert(users).values({
            name,
            email: email.toLowerCase(),
            passwordHash: hash,
            orgId: invite?.orgId || null, // Auto-link to org if invite has it
            role: invite?.role || 'ORG_ADMIN',
            isActive: true,
            emailVerified: verified
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
