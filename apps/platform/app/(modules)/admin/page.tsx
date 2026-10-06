import Link from 'next/link';
import { auth } from '@aic/auth';
import AdminShell from './components/AdminShell';
import { ViewAsPicker } from '@/app/components/workspace/ViewAsPicker';
import { STAFF_NAV, visibleGroups } from '@/app/components/workspace/nav';
import { StatTile, TileGrid, Panel, StackBar, BarList, ActionList, dailySeries, pct, type Segment } from '@/app/components/dash/Dash';
import { hasCapability } from '@/lib/rbac';
import { getStaffDashboard, DECISION_DAYS } from '@/lib/dashboard/staff';
import type { WorkspaceUser } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

/**
 * Where AIC staff land after signing in: what needs them, and how much AI the
 * register's clients are running. Every figure comes from lib/dashboard/staff.ts,
 * which counts rows and returns null for anything this person may not see or
 * the database cannot answer; a null figure is left out, never shown as zero.
 */

const fmt = (v: number) => v.toLocaleString('en-GB');
const day = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Johannesburg' });
const plural = (v: number, one: string, many = `${one}s`) => `${fmt(v)} ${v === 1 ? one : many}`;

const STATUS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Not yet certified', color: '#a8b2bf' },
  PENDING: { label: 'In assessment', color: '#5e6b7b' },
  ADVISORY: { label: 'Advisory', color: '#c3cad3' },
  READINESS: { label: 'Readiness', color: '#8a95a3' },
  STAGE_1_DOCS: { label: 'Stage 1 documents', color: '#5e6b7b' },
  STAGE_2_TECHNICAL: { label: 'Stage 2 technical', color: '#0a1728' },
  PENDING_REVIEW: { label: 'Under review', color: '#b45309' },
  REVISION_REQUIRED: { label: 'Revisions requested', color: '#d08a3a' },
  APPROVED: { label: 'Approved, not yet issued', color: '#a8772a' },
  CERTIFIED: { label: 'Certified', color: '#2e7a57' },
  ACTIVE: { label: 'Certified', color: '#2e7a57' },
  SUSPENDED: { label: 'Suspended', color: '#b23a35' },
  REVOKED: { label: 'Revoked', color: '#7d2925' },
  EXPIRED: { label: 'Expired', color: '#e0b4b1' },
};

function statusSegments(rows: { status: string | null; n: number }[]): Segment[] {
  const merged = new Map<string, Segment>();
  for (const r of rows) {
    const key = r.status ?? 'DRAFT';
    const known = STATUS[key];
    const label = known?.label ?? key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, ' ');
    const prev = merged.get(label);
    if (prev) prev.n += r.n;
    else merged.set(label, { label, n: r.n, color: known?.color ?? '#dde2e8' });
  }
  return [...merged.values()].sort((a, b) => b.n - a.n);
}

function greeting(now: Date) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Africa/Johannesburg' }).format(now));
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

export default async function StaffHome() {
  const session = await auth();
  const user = (session?.user ?? {}) as WorkspaceUser & { id?: string; name?: string | null };
  const uid = user.id ?? '';

  const [conductAssessment, viewAllOrgs, approveCertification, issueCertification, clearConflict] = await Promise.all([
    hasCapability(uid, 'conduct_assessment'),
    hasCapability(uid, 'view_all_orgs'),
    hasCapability(uid, 'approve_certification'),
    hasCapability(uid, 'issue_certification'),
    hasCapability(uid, 'clear_impartiality_conflict'),
  ]);
  const now = new Date();
  const d = await getStaffDashboard({ conductAssessment, viewAllOrgs, approveCertification, issueCertification, clearConflict }, now);

  const groups = visibleGroups(STAFF_NAV, user);
  const first = user.name?.trim().split(/\s+/)[0];

  // Things waiting on a decision from someone with the authority to make it.
  const decide: { label: string; detail?: string; href: string; tone: 'bad' | 'warn' | 'muted' }[] = [];
  if (d.conflicts) decide.push({ label: `${plural(d.conflicts, 'conflict declaration')} to review`, detail: 'Assessors were blocked from taking these files.', href: '/admin/organizations', tone: 'bad' });
  if (d.pendingReview) decide.push({ label: `${plural(d.pendingReview, 'organisation')} under review`, detail: 'Waiting for a certification decision.', href: '/admin/organizations', tone: 'warn' });
  if (d.awaitingIssue) decide.push({ label: `${plural(d.awaitingIssue, 'approved organisation')} without a certificate`, detail: 'Approved and not yet issued.', href: '/admin/certifications', tone: 'warn' });
  if (d.stage2) decide.push({ label: `${plural(d.stage2, 'file')} at stage 2 technical`, detail: 'The next step is the certification decision.', href: '/admin/organizations', tone: 'muted' });
  if (d.findings?.responsesToReview) decide.push({ label: `${plural(d.findings.responsesToReview, 'corrective action response')} to review`, detail: 'Clients have answered a finding.', href: '/admin/organizations', tone: 'warn' });
  const showDecide = approveCertification || issueCertification || clearConflict || conductAssessment;

  const exposure = d.systems || d.decisions || d.undeclared || d.connectors;
  const panels = d.orgStatus || d.expiring || d.mostActive || showDecide;

  return (
    <AdminShell>
      <header className="mb-6 md:mb-8">
        <h1 className="font-serif text-[30px] md:text-[34px] leading-tight font-semibold text-[#0e1b2c]">{first ? `${greeting(now)}, ${first}` : greeting(now)}</h1>
        <p className="mt-1 text-sm text-[#5e6b7b]">
          {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Johannesburg' })}
          {decide.length > 0 ? `. ${plural(decide.length, 'thing')} waiting on a decision.` : '.'}
        </p>
      </header>

      {groups.length === 0 && session && (
        <p className="mb-8 text-sm text-[#5e6b7b]">Your account has no staff capabilities yet. Ask a super admin to grant them.</p>
      )}

      <div className="space-y-6 md:space-y-8">
        {(d.queue || d.audits || d.applications || d.findings) && (
          <section aria-labelledby="work">
            <h2 id="work" className="mb-3 text-[15px] font-semibold text-[#0e1b2c]">Assessment work</h2>
            <TileGrid>
              {d.queue && <StatTile label="Evidence to review" value={fmt(d.queue.waiting)} sub="Not yet accepted or sent back" href="/admin/queue" />}
              {d.audits && <StatTile label="Audits in the next 14 days" value={fmt(d.audits.next14)} sub={d.audits.soonest ? `Next on ${day(d.audits.soonest)}` : 'None scheduled'} href="/admin/audits" />}
              {d.applications && <StatTile label="Applications waiting" value={fmt(d.applications.waiting)} sub={`${fmt(d.applications.total)} received in total`} href="/admin/applications" />}
              {d.findings && <StatTile label="Findings overdue" value={fmt(d.findings.overdue)} tone={d.findings.overdue > 0 ? 'bad' : 'ink'} sub={`${fmt(d.findings.open)} open across clients`} href="/admin/organizations" />}
            </TileGrid>
          </section>
        )}

        {exposure && (
          <section aria-labelledby="exposure">
            <h2 id="exposure" className="mb-3 text-[15px] font-semibold text-[#0e1b2c]">AI exposure across clients</h2>
            <TileGrid>
              {d.systems && <StatTile label="Declared AI systems" value={fmt(d.systems.total)} sub={`${fmt(d.systems.tier1)} at risk tier 1, across ${plural(d.systems.orgs, 'client')}`} href="/admin/organizations" />}
              {d.decisions && (
                <StatTile
                  label={`Decisions, last ${DECISION_DAYS} days`}
                  value={fmt(d.decisions.last30)}
                  sub={d.decisions.last30 > 0 ? `${pct(d.decisions.overrides / d.decisions.last30)} overridden by a person` : 'None logged'}
                  spark={dailySeries(d.decisions.daily, DECISION_DAYS, now)}
                />
              )}
              {d.undeclared && (
                <StatTile
                  label="Deciding but not declared"
                  value={fmt(d.undeclared.systems)}
                  tone={d.undeclared.systems > 0 ? 'warn' : 'ink'}
                  sub={d.undeclared.systems > 0 ? `Systems logging decisions at ${plural(d.undeclared.orgs, 'client')}` : 'Every logging system is declared'}
                  href="/admin/organizations"
                />
              )}
              {d.connectors && (
                <StatTile
                  label="Connector errors, 7 days"
                  value={fmt(d.connectors.errors)}
                  tone={d.connectors.errors > 0 ? 'warn' : 'ink'}
                  sub={d.connectors.errors > 0 ? `At ${plural(d.connectors.orgs, 'client')}` : 'No failed runs'}
                  href="/admin/connectors"
                />
              )}
            </TileGrid>
          </section>
        )}

        {panels && (
          <div className="grid gap-3 lg:grid-cols-2">
            {showDecide && (
              <Panel title="Needs a decision">
                <ActionList items={decide} />
              </Panel>
            )}
            {d.orgStatus && (
              <Panel title="Organisations by status" href="/admin/organizations" linkLabel="See organisations">
                <StackBar segments={statusSegments(d.orgStatus)} empty="No organisations registered yet." />
              </Panel>
            )}
            {d.expiring && (
              <Panel title="Certificates expiring in 90 days" href="/admin/certifications" linkLabel="See certificates">
                {d.expiring.rows.length === 0 ? (
                  <p className="text-[13.5px] text-[#2e7a57]">None expire in the next 90 days.</p>
                ) : (
                  <ul className="divide-y divide-[#eef1f5]">
                    {d.expiring.rows.map((c) => {
                      const days = Math.ceil((c.expiry.getTime() - now.getTime()) / 86_400_000);
                      return (
                        <li key={c.id} className="flex items-baseline justify-between gap-3 py-2 text-[13.5px]">
                          <span className="min-w-0 truncate text-[#0e1b2c]">{c.org}</span>
                          <span className={`shrink-0 ${days <= 30 ? 'font-medium text-[#b23a35]' : 'text-[#5e6b7b]'}`}>{day(c.expiry)}, {plural(days, 'day')}</span>
                        </li>
                      );
                    })}
                    {d.expiring.total > d.expiring.rows.length && (
                      <li className="pt-2 text-[12.5px] text-[#5e6b7b]">and {fmt(d.expiring.total - d.expiring.rows.length)} more</li>
                    )}
                  </ul>
                )}
              </Panel>
            )}
            {d.mostActive && (
              <Panel title="Most active clients">
                <p className="-mt-2 mb-3 text-[12.5px] text-[#5e6b7b]">Decisions logged in the last {DECISION_DAYS} days</p>
                <BarList rows={d.mostActive.map((r) => ({ label: r.org, n: r.n }))} empty="No decisions logged in the last 30 days." />
              </Panel>
            )}
          </div>
        )}

        {groups.length > 0 && (
          <Panel title="Go to">
            <div className="space-y-4">
              {groups.map((group) => (
                <div key={group.key}>
                  <h3 className="mb-2 text-[12.5px] font-medium text-[#5e6b7b]">{group.label}</h3>
                  <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <li key={item.href}>
                          <Link href={item.href} className="flex h-11 items-center gap-2.5 rounded-xl border border-[#dde2e8] bg-[#f5f7f9] px-3 text-[13px] font-medium text-[#0e1b2c] transition-colors hover:border-[#a8772a] hover:bg-white">
                            <Icon className="h-4 w-4 shrink-0 text-[#5e6b7b]" aria-hidden="true" />
                            <span className="truncate">{item.label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </Panel>
        )}

        <ViewAsPicker />
      </div>
    </AdminShell>
  );
}
