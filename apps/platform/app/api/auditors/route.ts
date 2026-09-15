import { NextResponse } from 'next/server';
import { auth } from '@aic/auth';
import { getSystemDb, users, eq, or } from '@aic/db';
import { hasCapability } from '@/lib/rbac';

/**
 * AIC's own auditor roster - the "Lead Auditor" dropdown when scheduling an
 * institutional audit (app/(modules)/admin/audits).
 *
 * Reads the current 4-tier role model directly (AIC_AUDITOR, AIC_SUPER_ADMIN)
 * rather than the legacy AUDITOR value - see lib/roles.ts for why 'AUDITOR'
 * on a row today is either unmigrated or org-scoped, neither of which belongs
 * in a list of people AIC can assign to lead an audit.
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
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(or(eq(users.role, 'AIC_AUDITOR'), eq(users.role, 'AIC_SUPER_ADMIN')))
      .orderBy(users.name);

    return NextResponse.json({ auditors: rows });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch auditors' }, { status: 500 });
  }
}
