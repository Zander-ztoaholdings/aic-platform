import { NextResponse } from 'next/server';
import { auth } from '@aic/auth';
import { getSystemDb, organizations, eq, sql } from '@aic/db';
import { hasCapability } from '@/lib/rbac';

/**
 * The organisations an AIC staff member may see.
 *
 * `view_all_orgs` used to mean the whole register for anyone holding it, which
 * put every client organisation in front of every auditor regardless of whether
 * they had any part in assessing it. Impartiality is easier to demonstrate when
 * an assessor's view is limited to the files they are actually on, and
 * organizations.auditor_id already records that assignment.
 *
 * A super-admin still sees the register — somebody has to be able to assign
 * work and see the pipeline whole. An auditor sees their own assignments, and
 * an auditor with no assignments sees an empty list rather than everything,
 * which is the correct direction for that mistake to fall.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const authorized = await hasCapability(session.user.id, 'view_all_orgs');
  if (!authorized) return NextResponse.json({ error: 'Forbidden', message: 'Missing capability: view_all_orgs' }, { status: 403 });

  try {
    const db = getSystemDb();

    const rows = session.user.isSuperAdmin
      ? (await db.execute(sql`
          SELECT o.*, o.created_at AS "createdAt",
                 (SELECT count(*)::int FROM users u WHERE u.org_id = o.id AND u.email NOT LIKE '%@removed.invalid') AS "memberCount",
                 (SELECT count(*)::int FROM users u WHERE u.org_id = o.id AND COALESCE(u.is_active, true) AND u.email NOT LIKE '%@removed.invalid') AS "activeMembers"
          FROM organizations o ORDER BY o.name`)).rows
      : await db
          .select()
          .from(organizations)
          .where(eq(organizations.auditorId, session.user.id as string))
          .orderBy(organizations.name);

    return NextResponse.json(rows);
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 });
  }
}
