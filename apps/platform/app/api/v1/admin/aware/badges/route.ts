import { NextResponse } from 'next/server';
import { auth } from '@aic/auth';
import { getSystemDb, awareBadges, accountablePersons, organizations, eq, desc } from '@aic/db';
import { hasCapability } from '@/lib/rbac';
import { badgeStatus } from '@/lib/aware/badge';

export const dynamic = 'force-dynamic';

/** Every AIC Aware badge across all organisations, newest first. Staff only. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasCapability(session.user.id as string, 'view_all_orgs'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rows = await getSystemDb()
    .select({
      id: awareBadges.id,
      code: awareBadges.code,
      orgId: awareBadges.orgId,
      orgNameAtIssue: awareBadges.orgNameAtIssue,
      orgNameNow: organizations.name,
      accountablePerson: accountablePersons.name,
      listed: awareBadges.listed,
      issuedAt: awareBadges.issuedAt,
      expiresAt: awareBadges.expiresAt,
      revokedAt: awareBadges.revokedAt,
      revocationReason: awareBadges.revocationReason,
      questionSetVersion: awareBadges.questionSetVersion,
    })
    .from(awareBadges)
    .leftJoin(organizations, eq(organizations.id, awareBadges.orgId))
    .leftJoin(accountablePersons, eq(accountablePersons.id, awareBadges.accountablePersonId))
    .orderBy(desc(awareBadges.issuedAt))
    .limit(500);

  return NextResponse.json({
    badges: rows.map((b) => ({ ...b, status: badgeStatus(b) })),
    canRevoke: await hasCapability(session.user.id as string, 'manage_certification_lifecycle'),
  });
}
