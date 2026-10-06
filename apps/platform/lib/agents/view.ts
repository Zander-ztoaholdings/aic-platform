/**
 * What the agent pages and API show: never a key or a secret value, only
 * that one is set and its last characters.
 */
import { getTenantDb, users, aiSystems, agents, eq, and } from '@aic/db';
import { readinessProblems, type AgentTool } from './config';
import { readToolSecrets } from './runtime';

type AgentRow = typeof agents.$inferSelect;

export function publicAgent(a: AgentRow) {
  const secrets = readToolSecrets(a);
  const tools = ((a.tools as AgentTool[]) ?? []).map((t) => (t.kind === 'http'
    ? { ...t, secretsSet: t.secretHeaders.filter((h) => !!secrets[t.name]?.[h]) }
    : t));
  return {
    id: a.id, name: a.name, slug: a.slug, purpose: a.purpose, ownerUserId: a.ownerUserId, aiSystemId: a.aiSystemId,
    provider: a.provider, model: a.model, instructions: a.instructions, tools, limits: a.limits, status: a.status,
    modelKeyHint: a.modelKeyHint, version: a.version, createdAt: a.createdAt, updatedAt: a.updatedAt,
    problems: readinessProblems({ instructions: a.instructions, modelKeyHint: a.modelKeyHint, ownerUserId: a.ownerUserId, tools: (a.tools as AgentTool[]) ?? [], aiSystemId: a.aiSystemId }),
  };
}

/** The people and declared AI systems an agent can be linked to. */
export async function agentChoices(orgId: string) {
  return getTenantDb(orgId).query(async (tx) => ({
    people: await tx.select({ id: users.id, name: users.name, email: users.email }).from(users).where(and(eq(users.orgId, orgId), eq(users.isActive, true))).orderBy(users.name),
    systems: await tx.select({ id: aiSystems.id, name: aiSystems.name }).from(aiSystems).where(eq(aiSystems.orgId, orgId)).orderBy(aiSystems.name),
  }));
}

/** True when the ids belong to this organisation (or are empty). */
export async function linksBelong(orgId: string, ownerUserId: string | null, aiSystemId: string | null): Promise<string | null> {
  const { people, systems } = await agentChoices(orgId);
  if (ownerUserId && !people.some((p) => p.id === ownerUserId)) return 'Choose an accountable person from your organisation.';
  if (aiSystemId && !systems.some((s) => s.id === aiSystemId)) return 'Choose one of your declared AI systems.';
  return null;
}

/**
 * Microsoft tenants this organisation has consented for. A tenant reaches an
 * agent only through the consent callback, which proves it with a token; a
 * tenant id typed into a request is never trusted, or one organisation could
 * point its agent at another organisation's consented tenant.
 */
export async function consentedTenants(orgId: string): Promise<Set<string>> {
  const rows = await getTenantDb(orgId).query((tx) => tx.select({ tools: agents.tools }).from(agents).where(eq(agents.orgId, orgId)));
  const out = new Set<string>();
  for (const t of rows.flatMap((r) => (r.tools as AgentTool[]) ?? [])) if (t.kind === 'sharepoint' && t.tenantId) out.add(t.tenantId);
  return out;
}

/** Drops any SharePoint tenant the organisation has not consented for. */
export function pinTenants(tools: AgentTool[], allowed: Set<string>): AgentTool[] {
  return tools.map((t) => (t.kind === 'sharepoint' && t.tenantId && !allowed.has(t.tenantId) ? { ...t, tenantId: null } : t));
}
