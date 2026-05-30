import { NextResponse } from 'next/server';
import { getTenantDb, auditRequirements, eq, desc } from '@aic/db';
import { getSession } from '../../../lib/auth';
import type { Session } from 'next-auth';

export async function GET() {
  const session = await getSession() as Session | null;
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orgId = session.user.orgId;
  const db = getTenantDb(orgId);

  return await db.query(async (tx) => {
    const rows = await tx
      .select()
      .from(auditRequirements)
      .where(eq(auditRequirements.orgId, orgId))
      .orderBy(desc(auditRequirements.createdAt));

    return NextResponse.json({ findings: rows });
  });
}
