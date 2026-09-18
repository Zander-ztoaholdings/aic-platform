import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, hitlLogs } from '@aic/db';
import { auth } from '@aic/auth';
import { createHash } from 'crypto';
import { requireOrgCapability, requireOrgId } from '@/lib/guard';
import { canRecordDecisions } from '@/lib/roles';

/**
 * Records a human-in-the-loop override.
 *
 * This is the most load-bearing write in the platform. Under HU-2 an override
 * is the evidence that a named person was answerable for an outcome, so a row
 * here is what an organisation produces when asked to show human oversight
 * actually happened.
 *
 * WHAT IT USED TO DO:
 *
 *   - Checked only `session.user.id`. Any authenticated identity, from any
 *     organisation, could write an override record.
 *   - Wrote through `getSystemDb()`, bypassing tenant scoping entirely.
 *   - Recorded no organisation at all, because `hitl_logs` had no org_id
 *     column. The row could not be produced as any particular organisation's
 *     evidence, and no row policy could cover it.
 *   - Hashed only actor, target and reason — so the attribution the record
 *     exists to establish was itself outside the integrity hash.
 *
 * It now requires membership of an organisation, requires a role that may
 * record decisions, writes through the tenant connection, and covers the
 * organisation and the timestamp in the hash.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const org = requireOrgId(session.user.orgId);
  if (org instanceof NextResponse) return org;

  // An AIC assessor must not be able to author the client's own evidence of
  // human oversight. Whoever attests to an override has to be the organisation
  // answerable for it.
  const refusal = requireOrgCapability(
    session.user.role,
    canRecordDecisions,
    'record a human override'
  );
  if (refusal) return refusal;

  try {
    const data = await req.json();

    if (!data?.overrideReason || typeof data.overrideReason !== 'string' || !data.overrideReason.trim()) {
      return NextResponse.json(
        { error: 'An override reason is required', message: 'An override nobody can account for is not oversight.' },
        { status: 400 }
      );
    }

    const recordedAt = new Date();

    const content = JSON.stringify({
      orgId: org.orgId,
      actorId: session.user.id,
      targetType: data.targetType ?? null,
      targetId: data.targetId ?? null,
      previousValue: data.previousValue ?? null,
      newValue: data.newValue ?? null,
      overrideReason: data.overrideReason,
      recordedAt: recordedAt.toISOString(),
    });
    const hash = createHash('sha256').update(content).digest('hex');

    const db = getTenantDb(org.orgId);

    const log = await db.query(async (tx) => {
      const [row] = await tx
        .insert(hitlLogs)
        .values({
          orgId: org.orgId,
          actorId: session.user.id,
          targetType: data.targetType,
          targetId: data.targetId,
          previousValue: data.previousValue,
          newValue: data.newValue,
          overrideReason: data.overrideReason,
          integrityHash: hash,
          createdAt: recordedAt,
        })
        .returning();
      return row;
    });

    return NextResponse.json({ success: true, logId: log.id, integrityHash: hash });
  } catch (error) {
    console.error('[HITL_API_ERROR]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
