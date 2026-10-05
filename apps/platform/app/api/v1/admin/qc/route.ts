import { NextResponse } from 'next/server';
import { getSystemDb, sql } from '@aic/db';
import { adminActor } from '@/lib/admin';

/** Evidence decisions from the last 60 days, for a second reviewer to sample. */
export async function GET() {
  const actor = await adminActor('conduct_assessment');
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const res = (await getSystemDb().execute(sql`
    select d.id, d.title, d.verification_outcome as outcome, d.verification_notes as notes, d.verified_at,
      o.id as org_id, o.name as organisation, r.code as requirement, u.name as reviewer
    from audit_documents d
    join organizations o on o.id = d.org_id
    left join audit_requirements r on r.id = d.requirement_id
    left join users u on u.id = d.verified_by
    where d.verified_at > now() - interval '60 days'
    order by d.verified_at desc limit 200`)) as unknown as { rows: unknown[] };
  return NextResponse.json({ decisions: res.rows });
}
