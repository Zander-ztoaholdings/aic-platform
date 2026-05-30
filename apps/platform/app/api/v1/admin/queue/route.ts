import { NextResponse } from 'next/server';
import { auth } from '@aic/auth';
import { getSystemDb, sql } from '@aic/db';
import { hasCapability } from '@/lib/rbac';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const authorized = await hasCapability(session.user.id, 'access_admin_tools');
  if (!authorized) return NextResponse.json({ error: 'Forbidden', message: 'Missing capability: access_admin_tools' }, { status: 403 });

  try {
    const db = getSystemDb();
    const queue = await db.execute(sql`
      SELECT 
        d.id, 
        o.name as org, 
        d.title as doc, 
        d.status, 
        d.risk_score as risk,
        d.created_at as date
      FROM audit_documents d
      JOIN organizations o ON d.org_id = o.id
      ORDER BY d.created_at DESC
      LIMIT 100
    `);
    return NextResponse.json(queue.rows);
  } catch (error) {
    console.error('[ADMIN_QUEUE_ERROR]', error);
    return NextResponse.json({ error: 'Failed to fetch audit queue' }, { status: 500 });
  }
}
