import { NextResponse } from 'next/server';
import { getSystemDb, sql } from '@aic/db';
import { adminActor } from '@/lib/admin';

/** What each member of AIC staff has actually done, from the records they signed. */
export async function GET() {
  const actor = await adminActor('access_hq');
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const res = (await getSystemDb().execute(sql`
    select u.id, u.name, u.email, u.role, u.last_login,
      (select count(*) from audit_documents d where d.verified_by = u.id)::int as evidence_reviewed,
      (select count(*) from audit_documents d where d.verified_by = u.id and d.verified_at > now() - interval '30 days')::int as evidence_reviewed_30d,
      (select count(*) from audit_findings f where f.raised_by = u.id)::int as findings_raised,
      (select max(d.verified_at) from audit_documents d where d.verified_by = u.id) as last_review
    from users u
    where (u.is_super_admin or u.role in ('AIC_AUDITOR','AIC_SUPER_ADMIN')) and u.is_active
      and u.email not like '%@removed.invalid'
    order by evidence_reviewed desc, u.name`)) as unknown as { rows: unknown[] };
  return NextResponse.json({ staff: res.rows });
}
