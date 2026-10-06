import { NextResponse } from 'next/server';
import { auth } from '@aic/auth';
import { getSystemDb, sql } from '@aic/db';
import { hasCapability } from '@/lib/rbac';
import { seatsByOrg } from '@/lib/assignments';

/**
 * The register, for AIC staff.
 *
 * Every assessor sees who is registered, in summary: name, Division, sector,
 * where they are in certification, when they signed up, and which assessor
 * holds the file. An assessor who cannot see the register cannot help a new
 * client or pick up an unassigned file, and a list of names is not evidence.
 *
 * What stays limited is the file itself. Opening an organisation's evidence
 * is for the assessor assigned to it, after a conflict declaration (see
 * [id]/claim), and for super admins.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const authorized = await hasCapability(session.user.id, 'view_all_orgs');
  if (!authorized) return NextResponse.json({ error: 'Forbidden', message: 'Missing capability: view_all_orgs' }, { status: 403 });

  try {
    const db = getSystemDb();
    const me = session.user.id as string;
    const rows = (await db.execute(sql`
      SELECT o.id, o.name, o.legal_name AS "legalName", o.division, o.sector, o.size_band AS "sizeBand",
             o.certification_status AS "certificationStatus", o.contact_email AS "contactEmail",
             o.created_at AS "createdAt", o.signup_completed_at AS "signupCompletedAt",
             o.auditor_id AS "auditorId", a.name AS "auditorName", (o.auditor_id = ${me}) AS "assignedToMe",
             (SELECT count(*)::int FROM users u WHERE u.org_id = o.id AND u.email NOT LIKE '%@removed.invalid') AS "memberCount",
             (SELECT count(*)::int FROM users u WHERE u.org_id = o.id AND COALESCE(u.is_active, true) AND u.email NOT LIKE '%@removed.invalid') AS "activeMembers",
             (SELECT count(*)::int FROM audit_documents d WHERE d.org_id = o.id AND d.verification_outcome IS NULL AND d.superseded_by IS NULL) AS "waitingEvidence",
             (SELECT max(u.last_login) FROM users u WHERE u.org_id = o.id) AS "lastActive"
      FROM organizations o LEFT JOIN users a ON a.id = o.auditor_id
      ORDER BY o.created_at DESC NULLS LAST`)).rows as { id: string }[];
    // Lead and reviewer (migration 018); empty before it runs.
    const seats = await seatsByOrg();
    return NextResponse.json(rows.map((r) => {
      const s = seats.get(r.id);
      return { ...r, lead: s?.lead ?? null, reviewer: s?.reviewer ?? null, reviewerIsMe: s?.reviewer?.id === me };
    }));
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 });
  }
}
