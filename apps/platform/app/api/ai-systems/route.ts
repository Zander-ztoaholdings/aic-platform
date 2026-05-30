import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, aiSystems, eq } from '@aic/db';
import { auth } from '@aic/auth';

export async function GET() {
  const session = await auth();
  if (!session?.user?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = getTenantDb(session.user.orgId);
    const systems = await db.query(async (tx) => {
      return await tx
        .select()
        .from(aiSystems)
        .where(eq(aiSystems.orgId, session.user.orgId));
    });

    return NextResponse.json({ systems });
  } catch (error) {
    console.error('AI Systems Load Error:', error);
    return NextResponse.json({ error: 'Failed to load AI systems' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { name, riskTier, lifecycleStage, isSandbox } = body;
    const orgId = session.user.orgId;
    const db = getTenantDb(orgId);

    const [newSystem] = await db.query(async (tx) => {
      return await tx.insert(aiSystems).values({
        orgId,
        name,
        riskTier: riskTier || 1,
        lifecycleStage: lifecycleStage || 'DEVELOPMENT',
        isSandbox: isSandbox !== undefined ? isSandbox : true,
        isActive: true
      }).returning();
    });

    return NextResponse.json({ success: true, system: newSystem });
  } catch (error) {
    console.error('AI System Save Error:', error);
    return NextResponse.json({ error: 'Failed to register AI system' }, { status: 500 });
  }
}
