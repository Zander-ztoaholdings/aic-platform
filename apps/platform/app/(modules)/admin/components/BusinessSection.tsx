import { StatTile, TileGrid, Panel, StackBar, BarList, ActionList, dailySeries, pct, type Segment } from '@/app/components/dash/Dash';
import { getHqDashboard, DAYS } from '@/lib/dashboard/hq';
import { STAGES, STAGE_LABEL } from '@/lib/markets';

/**
 * AIC's own business, on the staff home for super admins.
 *
 * This used to be a separate page at /hq/governance that repeated half of the
 * staff home (systems, decisions, evidence waiting) next to the half that was
 * its own. Only the half that was its own is kept: growth, the pipeline,
 * markets and how evidence decisions are landing. Every figure comes from
 * lib/dashboard/hq.ts; one that could not be read is left out, not shown as zero.
 */

const LEAD_LABEL: Record<string, string> = {
  NEW: 'New', PROSPECT: 'Prospect', CONTACTED: 'Contacted', QUALIFIED: 'Qualified', HIGH_INTENT: 'High intent',
  'RE-ENGAGED': 'Re-engaged', ALPHA_APPLIED: 'Alpha applied', ALPHA_ENROLLED: 'Alpha enrolled',
  CONVERTED: 'Converted', CERTIFIED: 'Certified', LOST: 'Lost',
};
const leadLabel = (s: string) => LEAD_LABEL[s] ?? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');

const STAGE_COLOUR: Record<string, string> = {
  watching: '#c9d0d8', mapped: '#8a95a3', preparing: '#a8772a', entering: '#0a1728', live: '#2e7a57', paused: '#e7d3b0',
};
const OUTCOME: Record<string, { label: string; color: string }> = {
  ACCEPTED: { label: 'Accepted', color: '#2e7a57' },
  INSUFFICIENT: { label: 'Insufficient', color: '#b45309' },
  REJECTED: { label: 'Rejected', color: '#b23a35' },
};

const num = (n: number) => n.toLocaleString('en-GB');
const plural = (n: number, one: string, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`;

export async function BusinessSection({ now }: { now: Date }) {
  const d = await getHqDashboard();
  const hasAny = d.leads || d.clients || d.subscribers || d.markets || d.evidence;
  if (!hasAny) return null;

  const actions: { label: string; detail?: string; href: string; tone: 'bad' | 'warn' | 'muted' }[] = [];
  for (const m of d.markets?.overdue.slice(0, 3) ?? []) {
    actions.push({ label: `${m.name}: next step overdue`, detail: m.nextStep ? `${m.nextStep} (due ${m.nextStepDue})` : `Due ${m.nextStepDue}`, href: '/hq/markets', tone: 'warn' });
  }
  if (d.clients?.pastDue) actions.push({ label: plural(d.clients.pastDue, 'client') + ' past due on billing', href: '/admin/organizations', tone: 'warn' });

  const marketSegments: Segment[] = d.markets ? STAGES.map((s) => ({ label: STAGE_LABEL[s], n: d.markets!.counts[s], color: STAGE_COLOUR[s] })) : [];
  const evidenceSegments: Segment[] = d.evidence
    ? d.evidence.byOutcome.map((o) => ({ label: OUTCOME[o.outcome]?.label ?? o.outcome, n: o.n, color: OUTCOME[o.outcome]?.color ?? '#8a95a3' }))
    : [];
  const evidenceTotal = evidenceSegments.reduce((a, s) => a + s.n, 0);
  const accepted = d.evidence?.byOutcome.find((o) => o.outcome === 'ACCEPTED')?.n ?? 0;

  return (
    <section id="business" aria-labelledby="business-title" className="scroll-mt-24 space-y-3">
      <div>
        <h2 id="business-title" className="text-[15px] font-semibold text-[#0e1b2c]">AIC’s own business</h2>
        <p className="text-[12.5px] text-[#5e6b7b]">Last {DAYS} days. Only super admins see this.</p>
      </div>
      <TileGrid>
        {d.leads && <StatTile label="New leads" value={num(d.leads.last30)} sub={`Last ${DAYS} days, ${num(d.leads.total)} in all`} spark={dailySeries(d.leads.daily, DAYS, now)} href="/hq/crm" />}
        {d.leads && <StatTile label="Open pipeline" value={num(d.leads.open)} sub="Leads not yet certified or lost" href="/hq/growth/revenue" />}
        {d.clients && (
          <StatTile label="Paying clients" value={num(d.clients.paying)} tone={d.clients.paying ? 'ink' : 'muted'}
            sub={`Of ${plural(d.clients.total, 'organisation')}${d.certified ? `, ${num(d.certified.orgs)} certified` : ''}`} />
        )}
        {d.subscribers && (
          <StatTile label="Newsletter subscribers" value={num(d.subscribers.active)} sub={`${d.subscribers.last30 ? '+' : ''}${num(d.subscribers.last30)} in the last ${DAYS} days`} href="/hq/subscribers" />
        )}
      </TileGrid>
      <div className="grid gap-3 lg:grid-cols-2">
        {actions.length > 0 && (
          <Panel title="Business needs attention">
            <ActionList items={actions} />
          </Panel>
        )}
        {d.leads && (
          <Panel title="Pipeline by stage" href="/hq/growth/revenue" linkLabel="See the pipeline">
            <BarList rows={d.leads.byStatus.map((r) => ({ label: leadLabel(r.status), n: r.n }))} empty="No leads yet." />
          </Panel>
        )}
        {d.markets && (
          <Panel title="Markets" href="/hq/markets" linkLabel="See markets">
            <p className="mb-3 text-[13px] text-[#5e6b7b]">
              {plural(d.markets.total, 'market')} on the board, {num(d.markets.counts.live)} live
              {d.markets.overdue.length ? `, ${num(d.markets.overdue.length)} with an overdue next step` : ''}.
            </p>
            <StackBar segments={marketSegments} empty="No markets on the board yet." />
          </Panel>
        )}
        {d.evidence && (
          <Panel title="How evidence decisions are landing" href="/hq/operations/qc" linkLabel="See quality control">
            <p className="mb-3 text-[13px] text-[#5e6b7b]">
              {evidenceTotal ? `${plural(evidenceTotal, 'decision')} in the last ${DAYS} days, ${pct(accepted / evidenceTotal)} accepted.` : `No decisions in the last ${DAYS} days.`}
            </p>
            <StackBar segments={evidenceSegments} empty="Nothing decided yet." />
          </Panel>
        )}
      </div>
    </section>
  );
}
