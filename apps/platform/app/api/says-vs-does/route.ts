import { NextResponse } from 'next/server';
import {
  getTenantDb, orgPolicies, policyAcceptances, integrationChecks, aiSystems, accountablePersons, decisionRecords,
  eq, and, isNull, sql,
} from '@aic/db';
import { policyCaller, orgMembers } from '@/lib/policies';
import { evaluateClaims, summarise, type Facts, type ObservedCheck } from '@/lib/says-vs-does';

export const dynamic = 'force-dynamic';

/**
 * Where the organisation's published policies and its systems disagree.
 * Read-only; every result names the policy version that made the promise and
 * the check or record that bears on it.
 */
export async function GET() {
  const c = await policyCaller();
  if ('error' in c) return c.error;
  const db = getTenantDb(c.orgId);

  const [policies, acceptances, checks, systems, persons, recent] = await db.query(async (tx) => [
    await tx.select().from(orgPolicies).where(eq(orgPolicies.orgId, c.orgId)),
    await tx.select({ policyId: policyAcceptances.policyId, version: policyAcceptances.version }).from(policyAcceptances).where(eq(policyAcceptances.orgId, c.orgId)),
    await tx.select({ checkKey: integrationChecks.checkKey, subject: integrationChecks.subject, status: integrationChecks.status, summary: integrationChecks.summary })
      .from(integrationChecks).where(eq(integrationChecks.orgId, c.orgId)),
    await tx.select({ name: aiSystems.name, lifecycleStage: aiSystems.lifecycleStage, isSandbox: aiSystems.isSandbox, isActive: aiSystems.isActive })
      .from(aiSystems).where(eq(aiSystems.orgId, c.orgId)),
    await tx.select({ id: accountablePersons.id }).from(accountablePersons).where(and(eq(accountablePersons.orgId, c.orgId), isNull(accountablePersons.supersededAt))),
    await tx.select({
      systemName: decisionRecords.systemName,
      total: sql<number>`count(*)::int`,
      overrides: sql<number>`count(*) filter (where ${decisionRecords.isHumanOverride})::int`,
    }).from(decisionRecords)
      .where(and(eq(decisionRecords.orgId, c.orgId), sql`${decisionRecords.createdAt} > now() - interval '90 days'`))
      .groupBy(decisionRecords.systemName),
  ] as const);

  const members = (await orgMembers(c.orgId)).length;
  const active = systems.filter((s) => s.isActive !== false);
  const production = active.filter((s) => (s.lifecycleStage ?? '').toUpperCase() === 'PRODUCTION' && !s.isSandbox);
  const logged = new Set(recent.map((r) => r.systemName));
  const silent = production.filter((s) => !logged.has(s.name));
  const total = recent.reduce((n, r) => n + r.total, 0);
  const overrides = recent.reduce((n, r) => n + r.overrides, 0);

  const facts: Facts = {
    ai_systems_declared: active.length
      ? { ok: true, detail: `${active.length} AI ${active.length === 1 ? 'system is' : 'systems are'} declared.` }
      : { ok: false, detail: 'No AI systems are declared in the inventory.' },
    accountable_person_named: persons.length
      ? { ok: true, detail: 'An accountable person has signed the current declaration.' }
      : { ok: false, detail: 'No accountable person has signed the declaration.' },
    production_systems_logging: production.length === 0
      ? { ok: null, detail: 'No system is declared as in production yet.' }
      : silent.length === 0
        ? { ok: true, detail: `All ${production.length} production ${production.length === 1 ? 'system logs' : 'systems log'} decisions to AIC.` }
        : { ok: false, detail: `${silent.map((s) => s.name).join(', ')} ${silent.length === 1 ? 'is' : 'are'} in production but logged no decisions in 90 days, so no override can be shown.` },
    overrides_recorded: total < 20
      ? { ok: null, detail: total === 0 ? 'No decisions recorded in the last 90 days.' : `Only ${total} decisions recorded in 90 days, too few to judge an override rate.` }
      : overrides === 0
        ? { ok: false, detail: `${total} decisions in 90 days and none overridden. The policy says a rate near zero is investigated.` }
        : { ok: true, detail: `${overrides} of ${total} decisions overridden in 90 days (${((overrides / total) * 100).toFixed(1)}%).` },
  };

  const published = policies.filter((p) => p.publishedVersion > 0).map((p) => ({
    id: p.id, templateKey: p.templateKey, title: p.title, publishedVersion: p.publishedVersion, members,
    accepted: acceptances.filter((a) => a.policyId === p.id && a.version === p.publishedVersion).length,
  }));
  const results = evaluateClaims(published, checks as ObservedCheck[], facts);
  return NextResponse.json({
    results,
    summary: summarise(results),
    publishedPolicies: published.length,
    adoptedTemplates: policies.filter((p) => p.templateKey).length,
    connectedChecks: checks.length,
  });
}
