import Link from 'next/link';
import type { ReactNode } from 'react';
import { StatTile, TileGrid, Panel, StackBar, BarList, ActionList, dailySeries, pct, type Segment } from '@/app/components/dash/Dash';
import { getHqDashboard, DAYS } from '@/lib/dashboard/hq';
import { STAGES, STAGE_LABEL } from '@/lib/markets';

export const dynamic = 'force-dynamic';

/**
 * The HQ front door: AIC's own business at a glance. The /hq layout already
 * limits this to super admins (lib/workspace.ts canUseHq).
 *
 * Every figure comes from lib/dashboard/hq.ts, which counts rows and nothing
 * else. A tile whose source could not be read is left out, not shown as zero.
 */

const GO_TO: { href: string; label: string }[] = [
  { href: '/hq/growth/revenue', label: 'Pipeline' },
  { href: '/hq/crm', label: 'CRM' },
  { href: '/hq/subscribers', label: 'Newsletter subscribers' },
  { href: '/hq/cms', label: 'Public insights' },
  { href: '/hq/operations/qc', label: 'Quality control' },
  { href: '/hq/intelligence/engine', label: 'Audit engine' },
  { href: '/hq/training', label: 'Assessor academy' },
  { href: '/hq/people/performance', label: 'Staff activity' },
  { href: '/hq/people/hr', label: 'Roles' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/permissions', label: 'Permissions' },
  { href: '/hq/governance/regulator', label: 'Information Regulator' },
  { href: '/hq/governance/legal', label: 'Regulatory stack' },
  { href: '/hq/markets', label: 'Markets' },
];

const LEAD_LABEL: Record<string, string> = {
  NEW: 'New',
  PROSPECT: 'Prospect',
  CONTACTED: 'Contacted',
  QUALIFIED: 'Qualified',
  HIGH_INTENT: 'High intent',
  'RE-ENGAGED': 'Re-engaged',
  ALPHA_APPLIED: 'Alpha applied',
  ALPHA_ENROLLED: 'Alpha enrolled',
  CONVERTED: 'Converted',
  CERTIFIED: 'Certified',
  LOST: 'Lost',
};
const leadLabel = (s: string) => LEAD_LABEL[s] ?? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');

const STAGE_COLOUR: Record<string, string> = {
  watching: '#c9d0d8',
  mapped: '#8a95a3',
  preparing: '#a8772a',
  entering: '#0a1728',
  live: '#2e7a57',
  paused: '#e7d3b0',
};

const OUTCOME: Record<string, { label: string; color: string }> = {
  ACCEPTED: { label: 'Accepted', color: '#2e7a57' },
  INSUFFICIENT: { label: 'Insufficient', color: '#b45309' },
  REJECTED: { label: 'Rejected', color: '#b23a35' },
};

const num = (n: number) => n.toLocaleString('en-GB');
const plural = (n: number, one: string, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[15px] font-semibold text-[#0e1b2c]">{title}</h2>
      {children}
    </section>
  );
}

export default async function HqHome() {
  const d = await getHqDashboard();
  const now = new Date();

  const leadSpark = d.leads ? dailySeries(d.leads.daily, DAYS, now) : undefined;
  const decisionSpark = d.decisions ? dailySeries(d.decisions.daily, DAYS, now) : undefined;

  // Things someone at HQ should pick up, most urgent first. Only counts above zero.
  const actions: { label: string; detail?: string; href: string; tone: 'bad' | 'warn' | 'muted' }[] = [];
  if (d.markets?.overdue.length) {
    for (const m of d.markets.overdue.slice(0, 3)) {
      actions.push({ label: `${m.name}: next step overdue`, detail: m.nextStep ? `${m.nextStep} (due ${m.nextStepDue})` : `Due ${m.nextStepDue}`, href: '/hq/markets', tone: 'warn' });
    }
  }
  if (d.clients?.pastDue) actions.push({ label: plural(d.clients.pastDue, 'client') + ' past due on billing', href: '/admin/organizations', tone: 'warn' });
  if (d.evidence?.awaitingDecision) actions.push({ label: plural(d.evidence.awaitingDecision, 'evidence item') + ' awaiting a decision', href: '/admin/queue', tone: 'muted' });

  const marketSegments: Segment[] = d.markets
    ? STAGES.map((s) => ({ label: STAGE_LABEL[s], n: d.markets!.counts[s], color: STAGE_COLOUR[s] }))
    : [];
  const evidenceSegments: Segment[] = d.evidence
    ? d.evidence.byOutcome.map((o) => ({ label: OUTCOME[o.outcome]?.label ?? o.outcome, n: o.n, color: OUTCOME[o.outcome]?.color ?? '#8a95a3' }))
    : [];
  const evidenceTotal = evidenceSegments.reduce((a, s) => a + s.n, 0);
  const accepted = d.evidence?.byOutcome.find((o) => o.outcome === 'ACCEPTED')?.n ?? 0;

  return (
    <div className="max-w-6xl space-y-8">
      <header>
        <h1 className="font-serif text-[30px] md:text-[34px] leading-tight font-semibold text-[#0e1b2c]">AIC headquarters</h1>
        <p className="mt-1.5 text-[14.5px] text-[#5e6b7b]">How AIC itself is doing, over the last {DAYS} days.</p>
      </header>

      <Section title="Growth">
        <TileGrid>
          {d.leads && (
            <StatTile
              label="New leads"
              value={num(d.leads.last30)}
              sub={`Last ${DAYS} days, ${num(d.leads.total)} in all`}
              spark={leadSpark}
              href="/hq/crm"
            />
          )}
          {d.leads && (
            <StatTile
              label="Open pipeline"
              value={num(d.leads.open)}
              sub="Leads not yet certified or lost"
              href="/hq/growth/revenue"
            />
          )}
          {d.clients && (
            <StatTile
              label="Paying clients"
              value={num(d.clients.paying)}
              tone={d.clients.paying ? 'ink' : 'muted'}
              sub={`Of ${plural(d.clients.total, 'organisation')}${d.certified ? `, ${num(d.certified.orgs)} certified` : ''}`}
            />
          )}
          {d.subscribers && (
            <StatTile
              label="Newsletter subscribers"
              value={num(d.subscribers.active)}
              sub={`${d.subscribers.last30 ? '+' : ''}${num(d.subscribers.last30)} in the last ${DAYS} days`}
              href="/hq/subscribers"
            />
          )}
        </TileGrid>
      </Section>

      {(d.register || d.decisions || d.accountability) && (
        <Section title="AI exposure on the register">
          <TileGrid>
            {d.register && (
              <StatTile
                label="AI systems declared"
                value={num(d.register.systems)}
                sub={d.clients ? `Across ${plural(d.clients.total, 'client organisation')}` : 'In use across all clients'}
              />
            )}
            {d.decisions && (
              <StatTile
                label="Decisions logged"
                value={num(d.decisions.last30)}
                sub={`Last ${DAYS} days`}
                spark={decisionSpark}
              />
            )}
            {d.decisions && (
              <StatTile
                label="Awaiting human review"
                value={num(d.decisions.awaitingReview)}
                tone={d.decisions.overdueReview ? 'bad' : d.decisions.awaitingReview ? 'warn' : 'good'}
                sub={d.decisions.overdueReview ? `${num(d.decisions.overdueReview)} past the review date` : 'None past the review date'}
              />
            )}
            {d.accountability && (
              <StatTile
                label="No accountable person"
                value={num(d.accountability.orgsWithout)}
                tone={d.accountability.orgsWithout ? 'bad' : 'good'}
                sub={d.clients ? `Of ${plural(d.clients.total, 'client organisation')}` : 'Client organisations'}
              />
            )}
          </TileGrid>
        </Section>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel title="Needs attention">
          <ActionList items={actions} empty="Nothing is overdue." />
        </Panel>

        {d.leads && (
          <Panel title="Pipeline by stage" href="/hq/growth/revenue" linkLabel="Pipeline">
            <BarList rows={d.leads.byStatus.map((r) => ({ label: leadLabel(r.status), n: r.n }))} empty="No leads yet." />
          </Panel>
        )}

        {d.markets && (
          <Panel title="Markets" href="/hq/markets" linkLabel="Markets">
            <p className="mb-3 text-[13px] text-[#5e6b7b]">
              {plural(d.markets.total, 'market')} on the board, {num(d.markets.counts.live)} live
              {d.markets.overdue.length ? `, ${num(d.markets.overdue.length)} with an overdue next step` : ''}.
            </p>
            <StackBar segments={marketSegments} empty="No markets on the board yet." />
          </Panel>
        )}

        {d.evidence && (
          <Panel title="Evidence decisions" href="/hq/operations/qc" linkLabel="Quality control">
            <p className="mb-3 text-[13px] text-[#5e6b7b]">
              {evidenceTotal
                ? `${plural(evidenceTotal, 'decision')} in the last ${DAYS} days, ${pct(accepted / evidenceTotal)} accepted.`
                : `No decisions in the last ${DAYS} days.`}
            </p>
            <StackBar segments={evidenceSegments} empty="Nothing decided yet." />
          </Panel>
        )}

        {d.register && (
          <Panel title="Declared systems by risk tier">
            <BarList
              rows={d.register.byRiskTier.map((r) => ({ label: r.tier == null ? 'No tier given' : `Tier ${r.tier}`, n: r.n }))}
              empty="No systems declared yet."
            />
          </Panel>
        )}
      </div>

      <Section title="Go to">
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {GO_TO.map((i) => (
            <li key={i.href}>
              <Link
                href={i.href}
                className="block h-full rounded-xl border border-[#dde2e8] bg-white px-3.5 py-3 text-[13.5px] font-medium text-[#0e1b2c] transition-colors hover:border-[#a8772a]"
              >
                {i.label}
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
