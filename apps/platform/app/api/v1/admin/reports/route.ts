import { NextResponse } from 'next/server';
import { getSystemDb, sql } from '@aic/db';
import { adminActor } from '@/lib/admin';

/**
 * Register-wide figures, each one a query over real rows. Where there is
 * nothing to measure yet (no certificate issued), the figure is null and the
 * page shows an em dash — never a placeholder number.
 */
export async function GET() {
  const actor = await adminActor('conduct_assessment');
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const db = getSystemDb();
  const one = async <T,>(q: ReturnType<typeof sql>) => ((await db.execute(q)) as unknown as { rows: T[] }).rows;

  const [orgs] = await one<{ total: number; with_systems: number; with_person: number }>(sql`
    select count(*)::int as total,
      count(*) filter (where exists (select 1 from ai_systems s where s.org_id = o.id and s.is_active))::int as with_systems,
      count(*) filter (where exists (select 1 from accountable_persons p where p.org_id = o.id))::int as with_person
    from organizations o`);
  const byStatus = await one<{ status: string; n: number }>(sql`
    select coalesce(certification_status, 'DRAFT') as status, count(*)::int as n from organizations group by 1 order by 2 desc`);
  const [velocity] = await one<{ median_days: number | null; n: number }>(sql`
    select percentile_cont(0.5) within group (order by extract(epoch from (c.first_issue - o.created_at)) / 86400)::float as median_days,
      count(*)::int as n
    from organizations o
    join (select org_id, min(issue_date) as first_issue from issued_certifications group by org_id) c on c.org_id = o.id`);
  const [evidence] = await one<{ waiting: number; oldest: string | null; accepted: number; rejected: number }>(sql`
    select count(*) filter (where verification_outcome is null and superseded_by is null)::int as waiting,
      min(created_at) filter (where verification_outcome is null and superseded_by is null) as oldest,
      count(*) filter (where verification_outcome = 'ACCEPTED')::int as accepted,
      count(*) filter (where verification_outcome in ('REJECTED','INSUFFICIENT'))::int as rejected
    from audit_documents`);
  const [findings] = await one<{ open: number; overdue: number }>(sql`
    select count(*) filter (where status in ('OPEN','RESPONSE_SUBMITTED'))::int as open,
      count(*) filter (where status in ('OPEN','RESPONSE_SUBMITTED') and due_at < now())::int as overdue
    from audit_findings`);
  const [checks] = await one<{ orgs: number; failing: number }>(sql`
    select count(distinct org_id)::int as orgs, count(*) filter (where status = 'fail')::int as failing from integration_checks`);
  const reports = await one<{ id: string; organisation: string | null; month_year: string; integrity_score: number; is_finalized: boolean; created_at: string }>(sql`
    select r.id, o.name as organisation, r.month_year, r.integrity_score, r.is_finalized, r.created_at
    from compliance_reports r left join organizations o on o.id = r.org_id
    order by r.created_at desc limit 50`);

  return NextResponse.json({ orgs, byStatus, velocity, evidence, findings, checks, reports });
}
