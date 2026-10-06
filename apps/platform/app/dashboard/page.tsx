import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Session } from 'next-auth';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import { getSession } from '../../lib/auth';
import { getClientDashboard } from '@/lib/dashboard/client';
import { narrateEvent } from '@/lib/continuity';
import { phaseFromCertificationStatus, PHASES } from '@/lib/phases';
import DashboardShell from '../components/DashboardShell';
import { StandingSeal } from '../components/workspace/StandingSeal';
import { StatTile, TileGrid, Panel, StackBar, BarList, ActionList, dailySeries, usd, pct } from '../components/dash/Dash';
import { ObserveButton } from './components/ObserveButton';

export const metadata = { title: 'Dashboard | AIC' };
export const dynamic = 'force-dynamic';

/**
 * The client home: AI exposure at a glance. Every number is read from the
 * record by lib/dashboard/client.ts; the full continuity record lives at
 * /record.
 */

const DIVISION_COLOR: Record<number, string> = { 1: '#b23a35', 2: '#b45309', 3: '#a8772a', 4: '#5e6b7b', 5: '#a8b2bf' };
const PROVIDER: Record<string, string> = { openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google', mistral: 'Mistral', aws_bedrock: 'AWS Bedrock', azure_openai: 'Azure OpenAI' };
const PROVIDER_COLOR = ['#0e1b2c', '#a8772a', '#5e6b7b', '#2e7a57', '#b45309', '#a8b2bf'];
const SEV_TONE = { BLOCKING: 'bad', MATERIAL: 'warn', ADVISORY: 'muted' } as const;
const GAP_HREF: Record<string, string> = {
  'HU-1-NO-ACCOUNTABLE-PERSON': '/organisation', 'HU-3-UNDECLARED-SYSTEM': '/overview', 'HU-3-UNDECLARED-USAGE': '/overview', 'HU-3-EMPTY-INVENTORY': '/overview',
  'EX-1-NO-STATED-PURPOSE': '/overview', 'FINDINGS-OVERDUE': '/findings', 'EVIDENCE-REJECTED': '/evidence', 'REQUIREMENTS-NOT-STARTED': '/evidence', 'HU-2-ZERO-OVERRIDES': '/pulse',
};

function ago(iso: string | null, now: number) {
  if (!iso) return null;
  const h = Math.floor((now - new Date(iso).getTime()) / 3_600_000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

export default async function Dashboard() {
  const session = (await getSession()) as Session | null;
  const orgId = session?.user?.orgId as string | undefined;
  if (!orgId) redirect('/login');

  const d = await getClientDashboard(orgId);
  const now = Date.now();
  if (!d) {
    return <DashboardShell><p className="text-sm text-[#5e6b7b]">Your organisation could not be found.</p></DashboardShell>;
  }
  const phase = phaseFromCertificationStatus(d.org.certificationStatus);
  const reqs = d.readiness.requirements;
  const accepted = reqs.byStatus['ACCEPTED'] ?? 0;
  const issues = d.issues.findingsOpen + (d.issues.incidentsOpen ?? 0) + d.issues.checksFailing;
  const overrideRate = d.decisions && d.decisions.total30 > 0 ? d.decisions.overrides30 / d.decisions.total30 : null;
  const highDivisions = d.systems.byDivision.filter((x) => x.division <= 2).reduce((a, x) => a + x.n, 0);

  // What needs someone, most urgent first.
  const actions: { label: string; detail?: string; href: string; tone: 'bad' | 'warn' | 'muted' }[] = [];
  if (d.agentsWaiting) actions.push({ label: `${d.agentsWaiting} agent ${d.agentsWaiting === 1 ? 'run is' : 'runs are'} waiting for a person`, href: '/agents', tone: 'warn' });
  if (d.decisions?.overdueReview) actions.push({ label: `${d.decisions.overdueReview} decision ${d.decisions.overdueReview === 1 ? 'review is' : 'reviews are'} overdue`, href: '/pulse', tone: 'bad' });
  else if (d.decisions?.pendingReview) actions.push({ label: `${d.decisions.pendingReview} ${d.decisions.pendingReview === 1 ? 'decision is' : 'decisions are'} waiting for human review`, href: '/pulse', tone: 'warn' });
  for (const g of [...d.gaps].sort((a, b) => ['BLOCKING', 'MATERIAL', 'ADVISORY'].indexOf(a.severity) - ['BLOCKING', 'MATERIAL', 'ADVISORY'].indexOf(b.severity))) {
    actions.push({ label: g.title, href: GAP_HREF[g.code] ?? '/overview', tone: SEV_TONE[g.severity] });
  }
  for (const f of Object.values(d.readiness.registers)) if (f && f.status === 'fail') actions.push({ label: f.label, href: f.href, tone: 'warn' });

  return (
    <DashboardShell>
      <div className="mx-auto max-w-[1180px] space-y-5 md:py-2">
        <header className="flex flex-wrap items-center gap-4" data-tour="standing">
          <div className="hidden sm:block"><StandingSeal phase={phase} size={64} /></div>
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-[26px] font-semibold leading-tight text-[#0e1b2c] md:text-[30px]">{d.org.name}</h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[#5e6b7b]">
              <span>{PHASES[phase]?.label ?? 'Intake'} stage{d.org.divisionName ? `, Division ${d.org.division} ${d.org.divisionName}` : ''}</span>
              {d.record && d.record.total > 0 && (
                <Link href="/record" className={`inline-flex items-center gap-1 ${d.record.chainOk ? 'text-[#2e7a57]' : 'text-[#b23a35]'}`}>
                  {d.record.chainOk ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                  {d.record.chainOk ? 'Record intact' : 'Record chain broken'}{d.record.lastObservedAt ? `, observed ${ago(d.record.lastObservedAt, now)}` : ''}
                </Link>
              )}
            </p>
          </div>
          <div className="w-full sm:w-auto"><ObserveButton firstRun={!d.record || d.record.total === 0} /></div>
        </header>

        <TileGrid>
          <StatTile
            label="AI systems"
            value={d.systems.total}
            href="/overview"
            tone={d.systems.undeclared.length ? 'bad' : 'ink'}
            sub={d.systems.undeclared.length ? <span className="text-[#b23a35]">{d.systems.undeclared.length} in use but not declared</span> : `${d.systems.inProduction} in production, ${highDivisions} in Divisions 1 and 2`}
          />
          <StatTile
            label="Decisions, last 30 days"
            value={d.decisions ? d.decisions.total30.toLocaleString('en-GB') : '–'}
            href="/pulse"
            spark={d.decisions ? dailySeries(d.decisions.byDay, 30) : undefined}
            sub={overrideRate === null ? 'None logged yet' : `${pct(overrideRate)} overridden by a person (${d.decisions!.overrides30} of ${d.decisions!.total30})`}
          />
          <StatTile
            label="AI spend this month"
            value={d.spend?.hasData ? usd(d.spend.monthToDate) : '–'}
            href="/spend"
            tone={d.spend?.hasData ? 'ink' : 'muted'}
            spark={d.spend?.hasData ? dailySeries(d.spend.byDay, 30) : undefined}
            sparkTone="ink"
            sub={!d.spend?.hasData ? 'Connect an AI provider to see it' : d.spend.projected !== null ? `On course for ${usd(d.spend.projected)} at this rate; last month ${usd(d.spend.lastMonth)}` : `Last month ${usd(d.spend.lastMonth)}`}
          />
          <StatTile
            label="Open issues"
            value={issues}
            tone={d.issues.findingsOverdue || d.issues.checksFailing ? 'bad' : issues ? 'warn' : 'good'}
            href={d.issues.findingsOpen ? '/findings' : d.issues.checksFailing ? '/checks' : '/incidents'}
            sub={`${d.issues.findingsOpen} ${d.issues.findingsOpen === 1 ? 'finding' : 'findings'}${d.issues.findingsOverdue ? ` (${d.issues.findingsOverdue} overdue)` : ''}, ${d.issues.incidentsOpen ?? 0} ${(d.issues.incidentsOpen ?? 0) === 1 ? 'incident' : 'incidents'}, ${d.issues.checksFailing} failing ${d.issues.checksFailing === 1 ? 'check' : 'checks'}`}
          />
        </TileGrid>

        <div className="grid gap-5 lg:grid-cols-3">
          <Panel title="Needs you" className="lg:col-span-2">
            <ActionList items={actions.slice(0, 7)} />
          </Panel>
          <Panel title="Certification readiness" href="/certificate" linkLabel="Your certificate">
            {d.certificate ? (
              <p className="text-[14px] text-[#0e1b2c]">Certificate {d.certificate.number}, {(d.certificate.status ?? 'recorded').toLowerCase()}{d.certificate.expires ? `, until ${new Date(d.certificate.expires).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}.</p>
            ) : null}
            <div className={d.certificate ? 'mt-3' : ''}>
              <div className="flex items-baseline justify-between text-[13px]"><span className="text-[#5e6b7b]">Requirements with accepted evidence</span><span className="font-medium text-[#0e1b2c]">{accepted} of {reqs.total}</span></div>
              <div className="mt-1.5 h-2 rounded-full bg-[#eef1f5]"><div className="h-2 rounded-full bg-[#2e7a57]" style={{ width: `${reqs.total ? (accepted / reqs.total) * 100 : 0}%` }} /></div>
            </div>
            <ul className="mt-4 space-y-1.5 text-[13px]">
              <li className="flex justify-between"><span className="text-[#5e6b7b]">Accountable people on record</span><span className={d.readiness.accountablePersons ? 'text-[#0e1b2c]' : 'text-[#b23a35]'}>{d.readiness.accountablePersons}</span></li>
              <li className="flex justify-between"><span className="text-[#5e6b7b]">Automated checks passing</span><span className="text-[#0e1b2c]">{d.issues.checksTotal - d.issues.checksFailing - d.issues.checksWarning} of {d.issues.checksTotal}</span></li>
              {Object.values(d.readiness.registers).map((f) => f && (
                <li key={f.href} className="flex justify-between gap-3"><Link href={f.href} className="truncate text-[#5e6b7b] hover:text-[#0e1b2c]">{f.label.split(':')[0]}</Link><span className={f.status === 'pass' ? 'text-[#2e7a57]' : f.status === 'fail' ? 'text-[#b23a35]' : f.status === 'pending' ? 'text-[#b45309]' : 'text-[#8a95a3]'}>{f.status === 'pass' ? 'In order' : f.status === 'fail' ? 'Gap' : f.status === 'pending' ? 'Due' : 'Not started'}</span></li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <Panel title="AI exposure by Division" href="/overview" linkLabel="AI estate">
            <StackBar segments={d.systems.byDivision.map((x) => ({ label: `${x.division} ${x.name}`, n: x.n, color: DIVISION_COLOR[x.division] }))} empty="No AI systems declared yet." />
            {d.systems.undeclared.length > 0 && (
              <p className="mt-3 text-[13px] text-[#b23a35]">Not declared: {d.systems.undeclared.slice(0, 4).join(', ')}{d.systems.undeclared.length > 4 ? ` and ${d.systems.undeclared.length - 4} more` : ''}.</p>
            )}
          </Panel>
          <Panel title="Decisions by system, 30 days" href="/pulse" linkLabel="Decision log">
            <BarList rows={d.decisions?.bySystem ?? []} empty="No decisions logged in the last 30 days." />
          </Panel>
          <Panel title="Spend by provider, this month" href="/spend" linkLabel="AI spend">
            <StackBar segments={(d.spend?.byProvider ?? []).map((p, i) => ({ label: PROVIDER[p.provider] ?? p.provider, n: Math.round(p.n), color: PROVIDER_COLOR[i % PROVIDER_COLOR.length] }))} empty="No usage reported this month." />
            {d.spend && d.spend.byProvider.length > 0 && <p className="mt-2 text-[12px] text-[#8a95a3]">US dollars, rounded, as your providers reported them.</p>}
          </Panel>
        </div>

        {d.record && d.record.events.length > 0 && (
          <Panel title="Latest changes" href="/record" linkLabel={`Full record (${d.record.total})`}>
            <ul className="divide-y divide-[#eef1f5]">
              {d.record.events.slice(0, 5).map((e) => (
                <li key={e.seq} className="flex items-start justify-between gap-4 py-2.5 text-[13.5px]">
                  <span className="min-w-0 text-[#0e1b2c]">{narrateEvent(e)}</span>
                  <span className="shrink-0 text-[12.5px] text-[#8a95a3]">{ago(e.observedAt, now)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <p className="text-[12px] leading-relaxed text-[#8a95a3]">Figures come from what you have declared and what AIC has observed; they are not a determination of legal compliance.</p>
      </div>
    </DashboardShell>
  );
}
