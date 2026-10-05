import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, integrations, EncryptionService, eq, and } from '@aic/db';
import { orgCaller, logIntegrationChange } from '@/lib/integrations/http';
import { AI_PROVIDERS, keyShapeProblem, keyHint, pullUsage, ProviderError, PROVIDER_LABEL, type Provider } from '@/lib/integrations/providers';
import { syncOrg } from '@/lib/integrations/sync';

const PROVIDERS = ['github', 'microsoft', ...AI_PROVIDERS] as const;
type AnyProvider = (typeof PROVIDERS)[number];

function parseProvider(p: string): AnyProvider | null {
  return (PROVIDERS as readonly string[]).includes(p) ? (p as AnyProvider) : null;
}

/**
 * Connect an AI provider, in either mode.
 *
 *   { mode: 'exporter' }            AIC never sees the provider key. The page
 *                                   then shows how to run the exporter.
 *   { mode: 'api_key', key: '…' }   AIC checks the key can read usage, then
 *                                   stores it encrypted and pulls nightly.
 *
 * Switching from api_key to exporter deletes the stored key.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const caller = await orgCaller({ manage: true });
  if ('error' in caller) return caller.error;
  const provider = parseProvider((await params).provider);
  if (!provider || provider === 'github' || provider === 'microsoft') return NextResponse.json({ error: 'Unknown provider.' }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { mode?: string; key?: string };
  const label = PROVIDER_LABEL[provider as Provider];
  let values: { mode: string; secretCiphertext: string | null; secretHint: string | null; status: string };

  if (body.mode === 'exporter') {
    values = { mode: 'exporter', secretCiphertext: null, secretHint: null, status: 'pending' };
  } else if (body.mode === 'api_key') {
    const key = (body.key ?? '').trim();
    const problem = keyShapeProblem(provider as Provider, key);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
    try {
      await pullUsage(provider as Provider, key, 1);
    } catch (e) {
      const status = e instanceof ProviderError ? e.status : 0;
      return NextResponse.json(
        {
          error:
            status === 401 || status === 403
              ? `${label} rejected that key. Check it is an admin key and that it has not been revoked.`
              : `AIC could not reach ${label} to check the key. Try again in a minute.`,
        },
        { status: 400 }
      );
    }
    values = { mode: 'api_key', secretCiphertext: EncryptionService.encrypt(key), secretHint: keyHint(key), status: 'pending' };
  } else {
    return NextResponse.json({ error: 'Choose how to connect: the exporter, or a read-only admin key.' }, { status: 400 });
  }

  const db = getTenantDb(caller.orgId);
  const [row] = await db.query((tx) =>
    tx.insert(integrations)
      .values({ orgId: caller.orgId, provider, ...values, connectedBy: caller.userId, accountLabel: label })
      .onConflictDoUpdate({
        target: [integrations.orgId, integrations.provider],
        set: { ...values, connectedBy: caller.userId, lastError: null, updatedAt: new Date() },
      })
      .returning({ id: integrations.id })
  );
  await logIntegrationChange({
    orgId: caller.orgId, actorId: caller.userId, integrationId: row?.id ?? null,
    previous: null, next: { provider, mode: values.mode, keyHint: values.secretHint }, reason: `Connected ${label} (${values.mode === 'api_key' ? 'stored read-only key' : 'exporter'})`,
  });
  await syncOrg(caller.orgId).catch((e) => console.error('[INTEGRATIONS] sync after connect failed:', e));
  return NextResponse.json({ ok: true });
}

/**
 * Link a repository or a model to a declared AI system (or mark it as not
 * used for automated decisions). Body: { subject, systemId: uuid | 'none' | null }.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const caller = await orgCaller();
  if ('error' in caller) return caller.error;
  if (caller.role !== 'ORG_ADMIN' && caller.role !== 'ORG_USER') {
    return NextResponse.json({ error: 'Only organisation members can link systems.' }, { status: 403 });
  }
  const provider = parseProvider((await params).provider);
  if (!provider) return NextResponse.json({ error: 'Unknown provider.' }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { subject?: string; systemId?: string | null };
  const subject = (body.subject ?? '').trim();
  if (!subject || subject.length > 255) return NextResponse.json({ error: 'Say which repository or model to link.' }, { status: 400 });
  const systemId = body.systemId ?? null;
  if (systemId !== null && systemId !== 'none' && !/^[0-9a-f-]{36}$/i.test(systemId)) {
    return NextResponse.json({ error: 'Unknown system.' }, { status: 400 });
  }

  const db = getTenantDb(caller.orgId);
  const updated = await db.query(async (tx) => {
    const [i] = await tx.select().from(integrations).where(and(eq(integrations.orgId, caller.orgId), eq(integrations.provider, provider))).limit(1);
    if (!i) return null;
    const settings = { ...((i.settings as Record<string, unknown>) ?? {}) };
    const links = { ...((settings.links as Record<string, string>) ?? {}) };
    const before = links[subject] ?? null;
    if (systemId === null) delete links[subject];
    else links[subject] = systemId;
    settings.links = links;
    await tx.update(integrations).set({ settings, updatedAt: new Date() }).where(eq(integrations.id, i.id));
    return { id: i.id, before };
  });
  if (!updated) return NextResponse.json({ error: 'That system is not connected.' }, { status: 404 });

  await logIntegrationChange({
    orgId: caller.orgId, actorId: caller.userId, integrationId: updated.id,
    previous: { subject, systemId: updated.before }, next: { subject, systemId }, reason: `Linked ${subject}`,
  });
  await syncOrg(caller.orgId).catch((e) => console.error('[INTEGRATIONS] sync after link failed:', e));
  return NextResponse.json({ ok: true });
}

/**
 * Disconnect. The stored key (if any) and the check results go; usage
 * already recorded stays, because it is part of the organisation's record.
 * For GitHub, the App must also be uninstalled on GitHub — the page says so.
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const caller = await orgCaller({ manage: true });
  if ('error' in caller) return caller.error;
  const provider = parseProvider((await params).provider);
  if (!provider) return NextResponse.json({ error: 'Unknown provider.' }, { status: 404 });

  const db = getTenantDb(caller.orgId);
  const removed = await db.query((tx) =>
    tx.delete(integrations)
      .where(and(eq(integrations.orgId, caller.orgId), eq(integrations.provider, provider)))
      .returning({ id: integrations.id, mode: integrations.mode, accountLabel: integrations.accountLabel, externalId: integrations.externalId })
  );
  if (removed.length === 0) return NextResponse.json({ error: 'That system is not connected.' }, { status: 404 });

  await logIntegrationChange({
    orgId: caller.orgId, actorId: caller.userId, integrationId: null,
    previous: { provider, ...removed[0] }, next: null, reason: `Disconnected ${provider}`,
  });
  return NextResponse.json({ ok: true, externalId: removed[0].externalId });
}
