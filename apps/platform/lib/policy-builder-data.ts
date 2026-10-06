import { getTenantDb, organizations, users, accountablePersons, integrations, and, eq, isNull } from '@aic/db';
import { CONNECTORS } from './connectors/catalog';
import type { BuilderContext } from './policy-builder';

const PROVIDER: Record<string, string> = { github: 'GitHub', microsoft: 'Microsoft 365', openai: 'OpenAI', anthropic: 'Anthropic', ...Object.fromEntries(CONNECTORS.map((c) => [c.key, c.name])) };

/** What AIC already knows that a policy needs: names, people, connected systems. */
export async function builderContext(orgId: string): Promise<BuilderContext> {
  const { org, people, ap, ints } = await getTenantDb(orgId).query(async (tx) => ({
    org: (await tx.select({ name: organizations.name, legal: organizations.legalName, email: organizations.contactEmail }).from(organizations).where(eq(organizations.id, orgId)).limit(1))[0],
    people: await tx.select({ name: users.name, jobTitle: users.jobTitle, email: users.email, active: users.isActive }).from(users).where(eq(users.orgId, orgId)),
    ap: (await tx.select({ name: accountablePersons.name, jobTitle: accountablePersons.jobTitle }).from(accountablePersons)
      .where(and(eq(accountablePersons.orgId, orgId), isNull(accountablePersons.supersededAt))).limit(1))[0] ?? null,
    ints: await tx.select({ provider: integrations.provider }).from(integrations).where(eq(integrations.orgId, orgId)),
  }));
  return {
    orgName: org?.legal || org?.name || 'the organisation',
    people: people.filter((p) => p.active !== false && !p.email.endsWith('@removed.invalid')).map((p) => ({ name: p.name, jobTitle: p.jobTitle ?? null })),
    accountable: ap,
    connected: [...new Set(ints.map((i) => PROVIDER[i.provider] ?? i.provider))],
    contactEmail: org?.email ?? null,
  };
}
