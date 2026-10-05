import { NextResponse } from 'next/server';
import { getTenantDb, integrations, integrationChecks, aiSystems, eq } from '@aic/db';
import { orgCaller } from '@/lib/integrations/http';
import { CHECKS } from '@/lib/integrations/catalog';
import { githubAppConfigured } from '@/lib/integrations/github';
import { microsoftConfigured } from '@/lib/integrations/microsoft';

/**
 * Connected systems and the latest result of every automated check, for the
 * Connected systems and Automated checks pages. Never returns a stored key —
 * only its last four characters.
 */
export async function GET() {
  const caller = await orgCaller();
  if ('error' in caller) return caller.error;
  const db = getTenantDb(caller.orgId);

  const [rows, checks, systems] = await db.query(async (tx) => [
    await tx.select().from(integrations).where(eq(integrations.orgId, caller.orgId)),
    await tx.select().from(integrationChecks).where(eq(integrationChecks.orgId, caller.orgId)),
    await tx.select({ id: aiSystems.id, name: aiSystems.name, isActive: aiSystems.isActive }).from(aiSystems).where(eq(aiSystems.orgId, caller.orgId)),
  ] as const);

  return NextResponse.json({
    canManage: caller.canManage,
    githubAppConfigured: githubAppConfigured(),
    microsoftConfigured: microsoftConfigured(),
    integrations: rows.map((i) => ({
      id: i.id,
      provider: i.provider,
      mode: i.mode,
      status: i.status,
      accountLabel: i.accountLabel,
      externalId: i.provider === 'github' || i.provider === 'microsoft' ? i.externalId : null,
      secretHint: i.secretHint,
      lastSyncedAt: i.lastSyncedAt,
      lastError: i.lastError,
      settings: i.settings,
      createdAt: i.createdAt,
    })),
    checks: checks.map((c) => ({
      id: c.id,
      checkKey: c.checkKey,
      subject: c.subject,
      status: c.status,
      summary: c.summary,
      detail: c.detail,
      failingSince: c.failingSince,
      observedAt: c.observedAt,
      provider: rows.find((r) => r.id === c.integrationId)?.provider ?? null,
    })),
    catalog: CHECKS,
    systems: systems.filter((s) => s.isActive !== false).map((s) => ({ id: s.id, name: s.name })),
  });
}
