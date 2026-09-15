import { NextResponse } from 'next/server';
import { auth } from '@aic/auth';
import { getSystemDb, organizations } from '@aic/db';
import { hasCapability } from '@/lib/rbac';

/**
 * The organisation picker for AIC-internal tooling (audit scheduling, and
 * anywhere else inside the Admin Command Center that needs "every org, by
 * name" rather than one org's own record).
 *
 * Deliberately separate from /api/v1/admin/organizations, which returns the
 * bare array the admin org-management screen expects. This one wraps the
 * list in `{ organizations: [...] }` because that is the shape every caller
 * of this specific path already expects (see app/(modules)/admin/audits) -
 * changing the v1 route's shape to match would be the wrong fix, since that
 * route already has its own caller relying on a bare array.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const authorized = await hasCapability(session.user.id, 'access_admin_tools');
  if (!authorized) {
    return NextResponse.json(
      { error: 'Forbidden', message: 'Missing capability: access_admin_tools' },
      { status: 403 }
    );
  }

  try {
    const db = getSystemDb();
    const rows = await db
      .select({ id: organizations.id, name: organizations.name, tier: organizations.tier })
      .from(organizations)
      .orderBy(organizations.name);

    return NextResponse.json({ organizations: rows });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 });
  }
}
