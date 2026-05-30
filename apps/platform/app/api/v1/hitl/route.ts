import { NextRequest, NextResponse } from 'next/server';
import { getSystemDb, hitlLogs } from '@aic/db';
import { auth } from '@aic/auth';
import { createHash } from 'crypto';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const data = await req.json();
    const db = getSystemDb();

    // 1. Calculate Integrity Hash
    const content = JSON.stringify({
      actorId: session.user.id,
      targetId: data.targetId,
      reason: data.overrideReason
    });
    const hash = createHash('sha256').update(content).digest('hex');

    // 2. Record immutable log
    const [log] = await db.insert(hitlLogs).values({
      actorId: session.user.id,
      targetType: data.targetType,
      targetId: data.targetId,
      previousValue: data.previousValue,
      newValue: data.newValue,
      overrideReason: data.overrideReason,
      integrityHash: hash
    }).returning();

    return NextResponse.json({ success: true, logId: log.id });

  } catch (error) {
    console.error('[HITL_API_ERROR]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
