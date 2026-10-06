import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@aic/auth';
import { getSystemDb, users, eq, sql } from '@aic/db';
import { hasCapability } from '@/lib/rbac';
import { resolveScope } from '@/lib/assignments';

/**
 * Evidence waiting across client files. ?scope=mine limits it to the
 * organisations the signed-in person leads or reviews; ?scope=all shows
 * everything. Without it, an auditor with assignments gets their own and
 * everyone else gets all (lib/assignments.ts defaultScope).
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Reading is assessment work, so an assessor may; changing anything still needs the admin tools.
  const authorized = (await hasCapability(session.user.id, 'conduct_assessment')) || (await hasCapability(session.user.id, 'access_admin_tools'));
  if (!authorized) return NextResponse.json({ error: 'Forbidden', message: 'Missing capability: conduct_assessment' }, { status: 403 });

  try {
    const db = getSystemDb();
    const [me] = await db.select({ role: users.role, isSuperAdmin: users.isSuperAdmin }).from(users).where(eq(users.id, session.user.id)).limit(1);
    const { scope, orgIds } = await resolveScope({ id: session.user.id, role: me?.role, isSuperAdmin: me?.isSuperAdmin }, request.nextUrl.searchParams.get('scope'));
    const mine = scope === 'mine' && orgIds !== null;
    const queue = mine && orgIds.length === 0 ? { rows: [] } : await db.execute(sql`
      SELECT 
        d.id, 
        o.name as org, 
        d.org_id as "orgId",
        d.title as doc, 
        d.status, 
        d.risk_score as risk,
        d.created_at as date
      FROM audit_documents d
      JOIN organizations o ON d.org_id = o.id
      ${mine ? sql`WHERE d.org_id IN (${sql.join(orgIds.map((id) => sql`${id}`), sql`, `)})` : sql``}
      ORDER BY d.created_at DESC
      LIMIT 100
    `);
    return NextResponse.json({ items: queue.rows, scope: mine ? 'mine' : 'all', canFilter: orgIds !== null });
  } catch (error) {
    console.error('[ADMIN_QUEUE_ERROR]', error);
    return NextResponse.json({ error: 'Failed to fetch audit queue' }, { status: 500 });
  }
}
