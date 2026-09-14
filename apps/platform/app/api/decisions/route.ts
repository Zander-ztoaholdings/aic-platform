import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, decisionRecords, eq, desc } from '@aic/db';
import { auth } from '@aic/auth';
import { resolveApiKey } from '@/lib/api-key-auth';
import { recordDecisionWithLedger } from '@/lib/ledger';

/**
 * The decision log — the integration point for anything that decides.
 *
 * WHY THIS CHANGED.
 *
 * It was session-authenticated only, which meant the one thing it exists for
 * could not use it: an agent, a model service, a batch job or any other
 * machine had no way to record a decision, because it had no browser cookie.
 * The entire "record what your AI actually does" proposition required a human
 * to sit and paste JSON into a form. Now a caller may present either a session
 * (a person, in the app) or an `aic_live_` API key (a system, anywhere).
 *
 * WHAT A KEY MAY NOT DO.
 *
 * A key-authenticated caller may record a decision. It may not record that a
 * human overrode one. An override is the single most load-bearing claim in the
 * whole standard — it is the evidence that a human was answerable for an
 * outcome — and a machine asserting one with no identified person behind it is
 * exactly the unfalsifiable claim the record exists to prevent. Under HU-2 the
 * override must be attributable to someone who can be asked about it, so it
 * has to come from an authenticated human. Refused with a reason, not silently
 * downgraded: a caller that thinks it logged human oversight and did not is
 * worse off than one that got an error.
 */

type Caller = { orgId: string; userId: string | null; via: 'session' | 'api_key' };

async function resolveCaller(request: Request): Promise<Caller | null> {
  const session = await auth();
  if (session?.user?.orgId) {
    return {
      orgId: session.user.orgId as string,
      userId: (session.user.id as string) ?? null,
      via: 'session',
    };
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
      const result = await tx
        .select()
        .from(decisionRecords)
        .where(eq(decisionRecords.orgId, caller.orgId))
        .orderBy(desc(decisionRecords.createdAt))
        .limit(50);

      return NextResponse.json({ decisions: result });
    });
  } catch (error) {
    console.error('[DECISIONS] GET error:', (error as Error).message);
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
      system_name,
      input_params,
      outcome,
      explanation,
      isHumanOverride,
      overrideReason,
      originalOutcome,
    } = body as Record<string, unknown>;

    if (!system_name || !input_params || !outcome) {
      return NextResponse.json(
        { error: 'system_name, input_params and outcome are required' },
        { status: 400 }
      );
    }

    if (typeof system_name !== 'string' || !system_name.trim()) {
      return NextResponse.json({ error: 'system_name must be a non-empty string' }, { status: 400 });
    }

    const override = isHumanOverride === true;

    if (override && caller.via === 'api_key') {
      return NextResponse.json(
        {
          error: 'A human override cannot be recorded by an API key.',
          // Spelled out because the caller has to change what it does, and a
          // bare 403 would send an integrator looking for a permissions bug
          // that does not exist.
          reason:
            'Under HU-2 an override is evidence that a named person was answerable for the ' +
            'outcome. A key identifies a system, not a person, so an override recorded this ' +
            'way would be unattributable. Record the decision with the key; have the person ' +
            'who overrode it record the override while signed in.',
        },
        { status: 403 }
      );
    }

    if (override && !(typeof overrideReason === 'string' && overrideReason.trim())) {
      return NextResponse.json(
        { error: 'overrideReason is required when isHumanOverride is true' },
        { status: 400 }
      );
    }

    const decision = await recordDecisionWithLedger({
      orgId: caller.orgId,
      systemName: system_name.trim(),
      inputParams: input_params,
      outcome,
      explanation,
      isHumanOverride: override,
      overrideReason: override ? overrideReason : undefined,
      originalOutcome: override ? originalOutcome : undefined,
      // Null for a key: there is no person, and writing the organisation's id
      // here to satisfy a column would put a false name on an accountability
      // record.
      overriddenBy: override ? caller.userId : null,
    });

    return NextResponse.json({ success: true, recorded_via: caller.via, decision }, { status: 201 });
  } catch (error) {
    console.error('[DECISIONS] POST error:', (error as Error).message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
