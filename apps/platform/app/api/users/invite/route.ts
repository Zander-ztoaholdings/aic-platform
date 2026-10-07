import { NextRequest, NextResponse } from 'next/server';
import { getSystemDb, users, organizations, passwordResetTokens, eq, and, isNull, desc } from '@aic/db';
import { auth } from '@aic/auth';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { canManageTeamAndKeys, ROLE_LABEL, type OrgRole } from '@/lib/roles';
import { issueToken, TOKEN_TTL } from '@/lib/auth-tokens';
import { sendEmail } from '@/lib/email';
import { appUrl } from '@/lib/app-url';
import { checkRateLimit } from '@/lib/rate-limit';

const InviteSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(1).max(255),
  role: z.enum(['ORG_ADMIN', 'ORG_USER']),
});

/**
 * Invite a colleague into the caller's organisation.
 *
 * Before: the invite was created and its link printed to the server log — the
 * invited person was never told. It linked to the password-reset page. And a
 * second invite to someone who had not yet accepted silently did nothing.
 *
 * Now: an email with a link to /invite, which names the organisation and the
 * person who invited them. Re-inviting a pending member of the same
 * organisation issues a fresh link. An address that already belongs to an
 * active account, or to another organisation, is refused with the same
 * message as success would give the outside world — but the inviting admin is
 * told plainly, because they are authenticated and it is their own team.
 */
/**
 * Invitations still waiting to be accepted, for the Waiting panel on the team
 * page. A pending invitation is an account in this organisation that has never
 * been activated and never signed in; a member who was later switched off has
 * signed in, so is not listed here. Any member may see who is waiting.
 */
export async function GET() {
  const session = await auth();
  const orgId = session?.user?.orgId as string | undefined;
  if (!orgId) return NextResponse.json({ error: 'Sign in with an organisation account.' }, { status: 401 });

  const db = getSystemDb();
  const pending = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, invitedAt: users.createdAt, updatedAt: users.updatedAt })
    .from(users)
    .where(and(eq(users.orgId, orgId), eq(users.isActive, false), isNull(users.lastLogin)))
    .orderBy(desc(users.createdAt))
    .limit(100);

  const withLinks = await Promise.all(pending.map(async (p) => {
    const [t] = await db
      .select({ expiresAt: passwordResetTokens.expiresAt, sentAt: passwordResetTokens.createdAt, used: passwordResetTokens.used })
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, p.id))
      .orderBy(desc(passwordResetTokens.createdAt))
      .limit(1);
    return {
      id: p.id,
      name: p.name,
      email: p.email,
      role: ROLE_LABEL[p.role as OrgRole] ?? p.role,
      roleKey: p.role,
      invitedAt: p.invitedAt,
      lastSentAt: t?.sentAt ?? p.invitedAt,
      linkExpiresAt: t && !t.used ? t.expiresAt : null,
    };
  }));

  return NextResponse.json({ pending: withLinks, canManage: canManageTeamAndKeys(session!.user.role as string | undefined) });
}

/**
 * Withdraws an invitation: the never-activated account and its links are
 * removed, so the emailed link stops working. Only for accounts that have
 * never signed in, so it cannot be used to remove a real member.
 */
export async function DELETE(request: NextRequest) {
  const session = await auth();
  const orgId = session?.user?.orgId as string | undefined;
  if (!orgId || !canManageTeamAndKeys(session!.user.role as string | undefined)) {
    return NextResponse.json({ error: 'Only an organisation admin can withdraw invitations.' }, { status: 403 });
  }
  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Which invitation?' }, { status: 400 });

  const db = getSystemDb();
  const [u] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(and(eq(users.id, id), eq(users.orgId, orgId), eq(users.isActive, false), isNull(users.lastLogin)))
    .limit(1);
  if (!u) return NextResponse.json({ error: 'That invitation has already been accepted or withdrawn.' }, { status: 404 });

  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, u.id));
  try {
    await db.delete(users).where(eq(users.id, u.id));
  } catch {
    // Something already refers to the account. The links are gone, so the
    // invitation cannot be accepted; the inactive account stays.
  }
  return NextResponse.json({ success: true, message: `The invitation to ${u.email} is withdrawn. Its link no longer works.` });
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const orgId = session?.user?.orgId as string | undefined;
    if (!orgId || !canManageTeamAndKeys(session!.user.role as string | undefined)) {
      return NextResponse.json({ error: 'Only an organisation admin can invite people.' }, { status: 403 });
    }
    if (!(await checkRateLimit(`invite:${session!.user.id}`, 30, 60 * 60_000)).allowed) {
      return NextResponse.json({ error: 'Too many invitations in a short time. Please try again later.' }, { status: 429 });
    }

    const parsed = InviteSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'A name, a valid email and a role are required.' }, { status: 400 });
    }
    const email = parsed.data.email.toLowerCase();
    const { name, role } = parsed.data;

    // Cross-organisation by nature: an email address is unique across the system.
    const db = getSystemDb();
    const [existing] = await db
      .select({ id: users.id, orgId: users.orgId, isActive: users.isActive })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    let userId: string;
    if (existing) {
      if (existing.orgId !== orgId) {
        return NextResponse.json({ error: 'That address already has an AIC account with another organisation.' }, { status: 409 });
      }
      if (existing.isActive) {
        return NextResponse.json({ error: 'That person is already a member of your organisation.' }, { status: 409 });
      }
      userId = existing.id; // pending invite: send a fresh link
      await db.update(users).set({ name, role }).where(eq(users.id, userId));
    } else {
      // Unusable random password; the account cannot sign in until the invite
      // is accepted and a password chosen.
      const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
      const [created] = await db
        .insert(users)
        .values({ email, passwordHash, name, role, orgId, isActive: false, emailVerified: false })
        .returning({ id: users.id });
      userId = created.id;
    }

    const token = await issueToken(userId, TOKEN_TTL.invite);
    const [org] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, orgId)).limit(1);
    const inviter = (session!.user.name as string | undefined) || 'A colleague';
    const orgName = org?.name ?? 'your organisation';
    const inviteLink = `${appUrl()}/invite?token=${token}`;

    const delivery = await sendEmail({
      to: email,
      subject: `${inviter} invited you to ${orgName} on AIC`,
      paragraphs: [
        `Hello ${name.split(' ')[0]},`,
        `${inviter} has invited you to join ${orgName} on AIC — AI Integrity Certification — as ${ROLE_LABEL[role as OrgRole] ?? role}.`,
        'Accept the invitation to choose your password. The link works once and expires in seven days.',
      ],
      action: { label: 'Accept invitation', url: inviteLink },
      footnote: 'If you were not expecting this, you can ignore it; no account is active until the invitation is accepted.',
    });

    return NextResponse.json({
      success: true,
      emailed: delivery.sent,
      // Only when the email could not be sent, so the admin can pass it on
      // another way. Never logged.
      ...(delivery.sent ? {} : { inviteLink }),
      message: delivery.sent
        ? `Invitation sent to ${email}.`
        : `The invitation was created but the email could not be sent. Share this link with ${name} directly.`,
    });
  } catch (error) {
    console.error('[SECURITY] Invite User Failure:', error);
    return NextResponse.json({ error: 'The invitation could not be created.' }, { status: 500 });
  }
}
