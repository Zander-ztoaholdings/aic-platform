import {
  accountablePersons, awareAssessments, awareBadges, organizations, users,
  and, eq, isNull, desc, getSystemDb,
} from '@aic/db';
import type { TenantTransaction } from '@aic/db';
import { badgeStatus, type BadgeStatus } from './badge';

/** Everything the /aware page needs about one organisation, read in one transaction. */
export async function readAwareState(tx: TenantTransaction, orgId: string) {
  const [person] = await tx
    .select({
      id: accountablePersons.id,
      name: accountablePersons.name,
      jobTitle: accountablePersons.jobTitle,
      email: accountablePersons.email,
      declarationAcceptedAt: accountablePersons.declarationAcceptedAt,
    })
    .from(accountablePersons)
    .where(and(eq(accountablePersons.orgId, orgId), isNull(accountablePersons.supersededAt)))
    .orderBy(desc(accountablePersons.declarationAcceptedAt))
    .limit(1);

  const [inProgress] = await tx
    .select()
    .from(awareAssessments)
    .where(and(eq(awareAssessments.orgId, orgId), eq(awareAssessments.status, 'IN_PROGRESS')))
    .orderBy(desc(awareAssessments.updatedAt))
    .limit(1);

  const [lastSubmitted] = await tx
    .select()
    .from(awareAssessments)
    .where(and(eq(awareAssessments.orgId, orgId), eq(awareAssessments.status, 'SUBMITTED')))
    .orderBy(desc(awareAssessments.submittedAt))
    .limit(1);

  const [badgeRow] = await tx
    .select()
    .from(awareBadges)
    .where(and(eq(awareBadges.orgId, orgId), isNull(awareBadges.revokedAt)))
    .orderBy(desc(awareBadges.issuedAt))
    .limit(1);

  const badge = badgeRow
    ? {
        code: badgeRow.code,
        orgNameAtIssue: badgeRow.orgNameAtIssue,
        issuedAt: badgeRow.issuedAt,
        expiresAt: badgeRow.expiresAt,
        listed: badgeRow.listed,
        questionSetVersion: badgeRow.questionSetVersion,
        status: badgeStatus(badgeRow) as BadgeStatus,
      }
    : null;

  return { accountablePerson: person ?? null, inProgress: inProgress ?? null, lastSubmitted: lastSubmitted ?? null, badge };
}

/** The organisation's registered name. Read with the system pool: organizations is keyed on id, not org_id. */
export async function orgName(orgId: string): Promise<string | null> {
  const [org] = await getSystemDb()
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  return org?.name ?? null;
}

/** Whether this person has confirmed their email. Badges wait on it. */
export async function emailVerified(userId: string): Promise<boolean> {
  const [u] = await getSystemDb()
    .select({ v: users.emailVerified })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return !!u?.v;
}
