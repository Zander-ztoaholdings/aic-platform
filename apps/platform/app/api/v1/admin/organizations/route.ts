import { NextResponse } from 'next/server';
import { auth } from '@aic/auth';
import { getSystemDb, organizations } from '@aic/db';
import { hasCapability } from '@/lib/rbac';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const authorized = await hasCapability(session.user.id, 'view_all_orgs');
  if (!authorized) return NextResponse.json({ error: 'Forbidden', message: 'Missing capability: view_all_orgs' }, { status: 403 });

  try {
    const db = getSystemDb();
    const allOrgs = await db.select().from(organizations).orderBy(organizations.name);
    return NextResponse.json(allOrgs);
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 });
  }
}
