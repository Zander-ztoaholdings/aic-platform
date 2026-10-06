import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, integrations, integrationChecks, EncryptionService, eq, and } from '@aic/db';
import { orgCaller, logIntegrationChange } from '@/lib/integrations/http';
import { CONNECTOR_BY_KEY } from '@/lib/connectors/catalog';
import { IMPLS, contextFor, importPeople } from '@/lib/connectors/registry';
import { ConnectorError } from '@/lib/connectors/types';
import { CHECK_BY_KEY } from '@/lib/integrations/catalog';
import { forgetLeavers } from '@/lib/registers/facts';
import { recordConnectorRun } from '@/lib/connectors/runs';

type Ctx = { params: Promise<{ key: string }> };

/**
 * Connect a system through a connector. AIC first runs the connector once
 * with the credential: if the provider rejects it, nothing is stored and the
 * person sees the provider's own reason. If it works, the credential is
 * stored encrypted and the first results are saved straight away.
 *
 * Body: { fields: { <field key>: value } }. Secrets are never sent back.
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  const caller = await orgCaller({ manage: true });
  if ('error' in caller) return caller.error;
  const { key } = await params;
  const def = CONNECTOR_BY_KEY[key];
  const impl = IMPLS[key];
  if (!def || !impl) return NextResponse.json({ error: 'Unknown connector.' }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { fields?: Record<string, unknown> };
  const creds: Record<string, string> = {};
  for (const f of def.fields) {
    const v = typeof body.fields?.[f.key] === 'string' ? (body.fields[f.key] as string).trim() : '';
    if (!v && !f.optional && f.kind !== 'select') return NextResponse.json({ error: `${f.label} is missing.` }, { status: 400 });
    if (v.length > 20_000) return NextResponse.json({ error: `${f.label} is too long.` }, { status: 400 });
    if (v) creds[f.key] = v;
    else if (f.kind === 'select' && f.options?.length) creds[f.key] = f.options[0].value;
  }
  const hasSecret = def.fields.some((f) => f.kind === 'secret' || f.kind === 'textarea');
  if (hasSecret && !EncryptionService.isConfigured()) {
    console.error('[CONNECTORS] refusing to store a credential: ENCRYPTION_KEY is not set');
    return NextResponse.json({ error: 'Storing credentials is not switched on for this AIC server yet, so nothing was saved.' }, { status: 503 });
  }

  // Try it before storing it.
  const ctx = await contextFor(caller.orgId, key);
  let out;
  try {
    out = await impl.run(creds, ctx);
  } catch (e) {
    const status = e instanceof ConnectorError ? e.status : 0;
    const msg = (e as Error).message;
    await recordConnectorRun(caller.orgId, key, 'error', null, msg, false);
    return NextResponse.json({
      error: status === 401 || status === 403
        ? `${def.name} did not accept that credential. ${msg}`
        : status === 400 ? msg
        : status === 0 ? `AIC could not reach ${def.name}. Check the address, and that it is reachable from the internet. (${msg})`
        : `AIC could not finish reading ${def.name}: ${msg}`,
    }, { status: 400 });
  }

  await recordConnectorRun(caller.orgId, key, 'ok', out.results, null, false);

  const secretField = def.fields.find((f) => f.kind === 'secret');
  const hint = secretField && creds[secretField.key] ? `…${creds[secretField.key].slice(-4)}` : null;
  const now = new Date();
  const db = getTenantDb(caller.orgId);
  const values = {
    mode: def.uses === 'microsoft' ? 'admin_consent' : 'api_key',
    status: 'active',
    secretCiphertext: Object.keys(creds).length ? EncryptionService.encrypt(JSON.stringify(creds)) : null,
    secretHint: hint,
    accountLabel: (out.label ?? def.name).slice(0, 255),
    lastSyncedAt: now,
    lastError: null,
    updatedAt: now,
  };
  const [row] = await db.query((tx) =>
    tx.insert(integrations).values({ orgId: caller.orgId, provider: key, ...values, connectedBy: caller.userId })
      .onConflictDoUpdate({ target: [integrations.orgId, integrations.provider], set: { ...values, connectedBy: caller.userId } })
      .returning({ id: integrations.id }));

  await db.query(async (tx) => {
    await tx.delete(integrationChecks).where(and(eq(integrationChecks.orgId, caller.orgId), eq(integrationChecks.integrationId, row.id)));
    for (const r of out.results) {
      if (!CHECK_BY_KEY[r.checkKey]) continue;
      await tx.insert(integrationChecks)
        .values({ orgId: caller.orgId, integrationId: row.id, checkKey: r.checkKey, subject: r.subject, status: r.status, summary: r.summary, detail: r.detail ?? {}, failingSince: r.status === 'fail' ? now : null, observedAt: now })
        .onConflictDoUpdate({
          target: [integrationChecks.orgId, integrationChecks.checkKey, integrationChecks.subject],
          set: { integrationId: row.id, status: r.status, summary: r.summary, detail: r.detail ?? {}, failingSince: r.status === 'fail' ? now : null, observedAt: now },
        });
    }
  });

  let people: number | null = null;
  if (impl.people) {
    try {
      const list = await impl.people(creds, ctx);
      await importPeople(caller.orgId, key, list);
      people = list.length;
    } catch (e) {
      console.error(`[CONNECTORS] ${key} people import failed:`, (e as Error).message);
    }
  }
  forgetLeavers(caller.orgId);

  await logIntegrationChange({
    orgId: caller.orgId, actorId: caller.userId, integrationId: row.id, previous: null,
    next: { provider: key, label: values.accountLabel, keyHint: hint }, reason: `Connected ${def.name} (read-only)`,
  });
  return NextResponse.json({ ok: true, label: values.accountLabel, checks: out.results.length, people });
}

/** Disconnect: the stored credential and the connector's check results are deleted. People it imported stay on the list. */
export async function DELETE(_r: NextRequest, { params }: Ctx) {
  const caller = await orgCaller({ manage: true });
  if ('error' in caller) return caller.error;
  const { key } = await params;
  const def = CONNECTOR_BY_KEY[key];
  if (!def) return NextResponse.json({ error: 'Unknown connector.' }, { status: 404 });
  const db = getTenantDb(caller.orgId);
  const [i] = await db.query((tx) => tx.select({ id: integrations.id, label: integrations.accountLabel }).from(integrations).where(and(eq(integrations.orgId, caller.orgId), eq(integrations.provider, key))).limit(1));
  if (!i) return NextResponse.json({ error: 'Not connected.' }, { status: 404 });
  await db.query((tx) => tx.delete(integrations).where(eq(integrations.id, i.id)));
  forgetLeavers(caller.orgId);
  await logIntegrationChange({ orgId: caller.orgId, actorId: caller.userId, integrationId: null, previous: { provider: key, label: i.label }, next: null, reason: `Disconnected ${def.name}` });
  return NextResponse.json({ ok: true });
}
