/**
 * Everything AIC holds about an organisation that can answer a buyer's
 * question, gathered once: what it has declared, what AIC issued, and what the
 * connectors observed. Used by the Trust page and by questionnaire drafting,
 * so both say the same thing from the same record.
 *
 * Server-only. Reads through the system connection because the Trust page is
 * public; callers must decide what of this may be shown to whom.
 */

import {
  getSystemDb, organizations, orgPolicies, policyAcceptances, integrationChecks, integrations, aiSystems,
  accountablePersons, awareBadges, issuedCertifications, decisionRecords, users,
  eq, and, isNull, desc, sql,
} from '@aic/db';
import type { CheckStatus } from '@/lib/integrations/catalog';

export interface OrgFacts {
  org: { id: string; name: string; legalName: string | null; division: number | null; website: string | null };
  badge: { code: string; issuedAt: string; expiresAt: string; status: 'valid' | 'expired' } | null;
  certificate: { number: string; standard: string | null; issued: string | null; expires: string | null; status: string } | null;
  accountablePerson: { name: string; jobTitle: string | null; since: string } | null;
  policies: { key: string | null; title: string; version: number; publishedAt: string | null; accepted: number; members: number }[];
  connectors: { provider: string; label: string | null; lastChecked: string | null }[];
  checks: { key: string; subject: string; status: CheckStatus; summary: string; observedAt: string | null }[];
  systems: { name: string; purpose: string | null; riskTier: number | null; stage: string | null }[];
  decisions: { last90: number; overrides: number };
}

const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);

export async function gatherOrgFacts(orgId: string): Promise<OrgFacts | null> {
  const db = getSystemDb();
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
  if (!org) return null;

  const [policies, acceptances, members, checks, conns, systems, persons, badges, certs, dec] = await Promise.all([
    db.select().from(orgPolicies).where(eq(orgPolicies.orgId, orgId)),
    db.select({ policyId: policyAcceptances.policyId, version: policyAcceptances.version }).from(policyAcceptances).where(eq(policyAcceptances.orgId, orgId)),
    db.select({ id: users.id, email: users.email }).from(users).where(and(eq(users.orgId, orgId), eq(users.isActive, true))),
    db.select().from(integrationChecks).where(eq(integrationChecks.orgId, orgId)),
    db.select().from(integrations).where(and(eq(integrations.orgId, orgId), eq(integrations.status, 'active'))),
    db.select().from(aiSystems).where(eq(aiSystems.orgId, orgId)),
    db.select().from(accountablePersons).where(and(eq(accountablePersons.orgId, orgId), isNull(accountablePersons.supersededAt))).orderBy(desc(accountablePersons.declarationAcceptedAt)).limit(1),
    db.select().from(awareBadges).where(and(eq(awareBadges.orgId, orgId), isNull(awareBadges.revokedAt))).orderBy(desc(awareBadges.issuedAt)).limit(1),
    db.select().from(issuedCertifications).where(eq(issuedCertifications.orgId, orgId)).orderBy(desc(issuedCertifications.issueDate)).limit(1),
    db.select({
      total: sql<number>`count(*)::int`,
      overrides: sql<number>`count(*) filter (where ${decisionRecords.isHumanOverride})::int`,
    }).from(decisionRecords).where(and(eq(decisionRecords.orgId, orgId), sql`${decisionRecords.createdAt} > now() - interval '90 days'`)),
  ]);

  const realMembers = members.filter((m) => !m.email.endsWith('@removed.invalid')).length;
  const b = badges[0];
  const c = certs[0];
  const p = persons[0];
  const providerLabel: Record<string, string> = { github: 'GitHub', microsoft: 'Microsoft 365', openai: 'OpenAI', anthropic: 'Anthropic' };

  return {
    org: { id: org.id, name: org.name, legalName: org.legalName ?? null, division: org.division ?? null, website: org.website ?? null },
    badge: b ? { code: b.code, issuedAt: iso(b.issuedAt)!, expiresAt: iso(b.expiresAt)!, status: new Date(b.expiresAt) > new Date() ? 'valid' : 'expired' } : null,
    certificate: c && !c.revokedAt ? { number: c.certNumber, standard: c.standard ?? null, issued: iso(c.issueDate), expires: iso(c.expiryDate), status: c.suspendedAt ? 'SUSPENDED' : (c.status ?? 'ACTIVE') } : null,
    accountablePerson: p ? { name: p.name, jobTitle: p.jobTitle ?? null, since: iso(p.declarationAcceptedAt)! } : null,
    policies: policies.filter((x) => x.publishedVersion > 0).map((x) => ({
      key: x.templateKey, title: x.title, version: x.publishedVersion, publishedAt: iso(x.updatedAt),
      accepted: acceptances.filter((a) => a.policyId === x.id && a.version === x.publishedVersion).length, members: realMembers,
    })),
    connectors: conns.map((x) => ({ provider: providerLabel[x.provider] ?? x.provider, label: x.accountLabel ?? null, lastChecked: iso(x.lastSyncedAt) })),
    checks: checks.map((x) => ({ key: x.checkKey, subject: x.subject, status: x.status as CheckStatus, summary: x.summary ?? '', observedAt: iso(x.observedAt) })),
    systems: systems.filter((s) => s.isActive !== false).map((s) => ({ name: s.name, purpose: s.purpose ?? null, riskTier: s.riskTier ?? null, stage: s.lifecycleStage ?? null })),
    decisions: { last90: dec[0]?.total ?? 0, overrides: dec[0]?.overrides ?? 0 },
  };
}
