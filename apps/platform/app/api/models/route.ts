import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, models, eq, and, desc, LedgerService } from '@aic/db';
import { getSession } from '../../../lib/auth';
import type { Session } from 'next-auth';

export async function GET() {
  try {
    const session = await getSession() as Session | null;
    if (!session || !session.user?.orgId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const orgId = session.user.orgId;
    const db = getTenantDb(orgId);

    return await db.query(async (tx) => {
      const result = await tx
        .select()
        .from(models)
        .where(and(eq(models.orgId, orgId), eq(models.isActive, true)))
        .orderBy(desc(models.createdAt));

      return NextResponse.json({ models: result });
    });
  } catch (error) {
    console.error('[SECURITY] Models GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession() as Session | null;
    if (!session || !session.user?.orgId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const orgId = session.user.orgId;

    const body = await request.json();
    const { name, version, type, description, metadata } = body;

    if (!name || !type) {
        return NextResponse.json({ error: 'Name and type are required' }, { status: 400 });
    }

    const db = getTenantDb(orgId);

    return await db.query(async (tx) => {
      const [newModel] = await tx.insert(models).values({
        orgId,
        name,
        version: version || '1.0.0',
        type,
        description,
        metadata: metadata || {}
      }).returning();

      // Record to Institutional Ledger
      await LedgerService.append('MODEL_REGISTERED', session.user.id, {
        modelId: newModel.id,
        orgId,
        name,
        version: version || '1.0.0'
      });

      return NextResponse.json({ success: true, model: newModel });
    });
  } catch (error) {
    console.error('[SECURITY] Models POST Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
