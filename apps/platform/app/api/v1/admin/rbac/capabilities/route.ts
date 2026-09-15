import { NextResponse } from 'next/server';
import { auth } from '@aic/auth';
import { getSystemDb, capabilities } from '@aic/db';
import { hasCapability } from '@/lib/rbac';

/** The full capability directory - app/admin/permissions ("God Mode"). */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const authorized = await hasCapability(session.user.id, 'access_admin_tools');
  if (!authorized) {
    return NextResponse.json({ error: 'Forbidden', message: 'Missing capability: access_admin_tools' }, { status: 403 });
  }

  try {
    const db = getSystemDb();
    const rows = await db.select().from(capabilities).orderBy(capabilities.category, capabilities.name);
    return NextResponse.json(rows);
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch capabilities' }, { status: 500 });
  }
}
