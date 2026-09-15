import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, llmUsageRecords, eq, desc } from '@aic/db';
import { auth } from '@aic/auth';
import { resolveApiKey } from '@/lib/api-key-auth';

/**
 * Provider/model usage - the read-only "middleman" for compliance
 * monitoring: an organisation's own tooling reports what it already knows
 * (spend, tokens, which provider and model, and optionally which declared
 * system it belongs to), AIC stores and cross-checks it, and nothing more.
 *
 * THE BOUNDARY THIS EXISTS TO KEEP, not work around: AIC never holds an
 * Anthropic/OpenAI/DeepSeek credential and never calls a provider itself -
 * see app/overview/page.tsx's READ_ONLY_MECHANISM string. This endpoint is
 * the receiving end of that mechanism for usage data specifically, the same
 * way /api/decisions is for decisions. If a future version of this needs to
 * call a provider directly to pull numbers instead of receiving them, that
 * is a different, bigger decision than adding a route, and belongs back in
 * that same boundary conversation, not decided here.
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

export async function POST(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Body must be a JSON object' }, { status: 400 });
    }

    const {
      provider,
      model,
      system_name,
      period_start,
      period_end,
      requests,
      input_tokens,
      output_tokens,
      cost_usd,
      region,
    } = body as Record<string, unknown>;

    if (!provider || typeof provider !== 'string' || !provider.trim()) {
      return NextResponse.json({ error: 'provider is required' }, { status: 400 });
    }
    if (!period_start || Number.isNaN(new Date(period_start as string).getTime())) {
      return NextResponse.json({ error: 'period_start must be a valid date' }, { status: 400 });
    }
    if (!period_end || Number.isNaN(new Date(period_end as string).getTime())) {
      return NextResponse.json({ error: 'period_end must be a valid date' }, { status: 400 });
    }

    const db = getTenantDb(caller.orgId);
    const row = await db.query(async (tx) => {
      const [result] = await tx
        .insert(llmUsageRecords)
        .values({
          orgId: caller.orgId,
          provider: provider.trim().toLowerCase(),
          model: typeof model === 'string' ? model : null,
          systemName: typeof system_name === 'string' ? system_name : null,
          periodStart: new Date(period_start as string),
          periodEnd: new Date(period_end as string),
          requests: typeof requests === 'number' ? Math.round(requests) : null,
          inputTokens: typeof input_tokens === 'number' ? Math.round(input_tokens) : null,
          outputTokens: typeof output_tokens === 'number' ? Math.round(output_tokens) : null,
          costUsd: typeof cost_usd === 'number' ? String(cost_usd) : null,
          region: typeof region === 'string' ? region : null,
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
          set: {
            requests: typeof requests === 'number' ? Math.round(requests) : null,
            inputTokens: typeof input_tokens === 'number' ? Math.round(input_tokens) : null,
            outputTokens: typeof output_tokens === 'number' ? Math.round(output_tokens) : null,
            costUsd: typeof cost_usd === 'number' ? String(cost_usd) : null,
            systemName: typeof system_name === 'string' ? system_name : null,
            region: typeof region === 'string' ? region : null,
          },
        })
        .returning();
      return result;
    });

    return NextResponse.json({ usage: row }, { status: 201 });
  } catch (error) {
    console.error('[USAGE] POST error:', (error as Error).message);
    return NextResponse.json({ error: 'Failed to record usage' }, { status: 500 });
  }
}
