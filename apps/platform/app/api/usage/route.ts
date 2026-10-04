import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, llmUsageRecords, integrations, eq, and, desc } from '@aic/db';
import { auth } from '@aic/auth';
import { resolveApiKey } from '@/lib/api-key-auth';

/**
 * Provider/model usage - the read-only "middleman" for compliance
 * monitoring: an organisation's own tooling reports what it already knows
 * (spend, tokens, which provider and model, and optionally which declared
 * system it belongs to), AIC stores and cross-checks it, and nothing more.
 *
 * This is the receiving end of the default "exporter" mode: the organisation
 * runs public/exporter/aic-usage-exporter.mjs with its own provider key and
 * pushes daily totals here, so AIC never sees that key. The opt-in "api_key"
 * mode (Zander, Oct 2026) pulls the same figures server-side instead — see
 * lib/integrations/providers.ts — and writes the same rows.
 *
 * Auth mirrors /api/decisions exactly: a signed-in person (session) or an
 * `aic_live_` API key (a system - a usage-export cron job, a billing
 * webhook relay, whatever the org already runs). Both may write; nothing
 * here has an "override" analog that would need to be human-only.
 */

type Caller = { orgId: string; userId: string | null; via: 'session' | 'api_key' };

async function resolveCaller(request: Request): Promise<Caller | null> {
  const session = await auth();
  if (session?.user?.orgId) {
    return { orgId: session.user.orgId as string, userId: (session.user.id as string) ?? null, via: 'session' };
  }
  const orgId = await resolveApiKey(request);
  return orgId ? { orgId, userId: null, via: 'api_key' } : null;
}

export async function GET(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getTenantDb(caller.orgId);
    return await db.query(async (tx) => {
      const rows = await tx
        .select()
        .from(llmUsageRecords)
        .where(eq(llmUsageRecords.orgId, caller.orgId))
        .orderBy(desc(llmUsageRecords.periodEnd))
        .limit(100);

      return NextResponse.json({ usage: rows });
    });
  } catch (error) {
    console.error('[USAGE] GET error:', (error as Error).message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

type UsageInput = Record<string, unknown>;

function validate(r: UsageInput): string | null {
  if (!r.provider || typeof r.provider !== 'string' || !r.provider.trim()) return 'provider is required';
  if (!r.period_start || Number.isNaN(new Date(r.period_start as string).getTime())) return 'period_start must be a valid date';
  if (!r.period_end || Number.isNaN(new Date(r.period_end as string).getTime())) return 'period_end must be a valid date';
  return null;
}

const MAX_BATCH = 500;

/**
 * One record, or a batch as { records: [...] } (what AIC's exporter sends).
 * A batch is all-or-nothing: one invalid record rejects the lot, with its
 * index, so the exporter's log says exactly which line to look at.
 */
export async function POST(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Body must be a JSON object' }, { status: 400 });
    }
    const batch = Array.isArray((body as { records?: unknown }).records);
    const records = (batch ? (body as { records: UsageInput[] }).records : [body]) as UsageInput[];
    if (records.length === 0) return NextResponse.json({ error: 'records is empty' }, { status: 400 });
    if (records.length > MAX_BATCH) return NextResponse.json({ error: `At most ${MAX_BATCH} records per request` }, { status: 400 });
    for (let i = 0; i < records.length; i++) {
      const problem = records[i] && typeof records[i] === 'object' ? validate(records[i]) : 'record must be an object';
      if (problem) return NextResponse.json({ error: batch ? `records[${i}]: ${problem}` : problem }, { status: 400 });
    }

    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null);
    const db = getTenantDb(caller.orgId);
    const rows = await db.query(async (tx) => {
      const out = [];
      for (const r of records) {
        const values = {
          requests: num(r.requests),
          inputTokens: num(r.input_tokens),
          outputTokens: num(r.output_tokens),
          costUsd: typeof r.cost_usd === 'number' && Number.isFinite(r.cost_usd) ? String(r.cost_usd) : null,
          systemName: typeof r.system_name === 'string' && r.system_name.trim() ? r.system_name.trim().slice(0, 255) : null,
          region: typeof r.region === 'string' ? r.region.slice(0, 100) : null,
        };
        const [result] = await tx
          .insert(llmUsageRecords)
          .values({
            orgId: caller.orgId,
            provider: (r.provider as string).trim().toLowerCase(),
            // The dedupe key includes model; a NULL there would never match
            // on re-send and would double-count.
            model: typeof r.model === 'string' && r.model.trim() ? r.model.trim().slice(0, 150) : '(unattributed)',
            periodStart: new Date(r.period_start as string),
            periodEnd: new Date(r.period_end as string),
            ...values,
            source: caller.via === 'api_key' ? 'export' : 'manual',
            ingestedVia: caller.via,
            submittedBy: caller.userId,
          })
          .onConflictDoUpdate({
            target: [
              llmUsageRecords.orgId,
              llmUsageRecords.provider,
              llmUsageRecords.model,
              llmUsageRecords.periodStart,
              llmUsageRecords.periodEnd,
            ],
            set: values,
          })
          .returning();
        out.push(result);
      }
      return out;
    });

    // An exporter connection waiting for its first data is now live.
    if (caller.via === 'api_key') {
      const providers = [...new Set(records.map((r) => (r.provider as string).trim().toLowerCase()))];
      await db.query(async (tx) => {
        for (const provider of providers) {
          await tx
            .update(integrations)
            .set({ status: 'active', lastError: null, updatedAt: new Date() })
            .where(and(eq(integrations.orgId, caller.orgId), eq(integrations.provider, provider), eq(integrations.mode, 'exporter')));
        }
      }).catch(() => {});
    }

    return NextResponse.json(batch ? { recorded: rows.length } : { usage: rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[USAGE] POST error:', (error as Error).message);
    return NextResponse.json({ error: 'Failed to record usage' }, { status: 500 });
  }
}
