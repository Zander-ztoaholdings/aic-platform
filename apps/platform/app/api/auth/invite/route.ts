import { NextRequest, NextResponse } from 'next/server';
import { getSystemDb, users, organizations, passwordResetTokens, and, eq, gte } from '@aic/db';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';
import { ROLE_LABEL, type OrgRole } from '@/lib/roles';

/**
 * What the /invite page shows before anyone types a password: whose
 * organisation, which address, which role. Only for a live, unused token
 * belonging to an account that has not yet been activated — so it cannot be
 * used to look up an existing member with an old reset link.
 * Accepting goes through /api/auth/reset-password, which activates the account.
 */
export async function GET(request: NextRequest) {
  const ip = getClientIP(request);
  if (!checkRateLimit(`invite-view:${ip}`, 30).allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  const token = request.nextUrl.searchParams.get('token') ?? '';
  if (!/^[0-9a-f]{64}$/.test(token)) {
    return NextResponse.json({ error: 'This invitation link is not valid.' }, { status: 400 });
  }

  const [row] = await getSystemDb()
    .select({ email: users.email, name: users.name, role: users.role, isActive: users.isActive, orgName: organizations.name })
    .from(passwordResetTokens)
    .innerJoin(users, eq(users.id, passwordResetTokens.userId))
    .leftJoin(organizations, eq(organizations.id, users.orgId))
    .where(and(eq(passwordResetTokens.token, token), eq(passwordResetTokens.used, false), gte(passwordResetTokens.expiresAt, new Date())))
    .limit(1);

  if (!row || row.isActive) {
    return NextResponse.json(
      { error: 'This invitation has expired or has already been used. Ask your admin to send a new one.' },
      { status: 410 }
    );
  }

  return NextResponse.json({
    email: row.email,
    name: row.name,
    organisation: row.orgName,
    role: ROLE_LABEL[row.role as OrgRole] ?? row.role,
  });
}
