import { NextResponse } from 'next/server';
import { getTenantDb, incidents, eq, desc } from '@aic/db';
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
        .from(incidents)
        .where(eq(incidents.orgId, orgId))
        .orderBy(desc(incidents.createdAt));

      return NextResponse.json({
          incidents: result
      });
    });
  } catch (error) {
    console.error('[SECURITY] Incidents GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
