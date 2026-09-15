import { redirect } from 'next/navigation';
import type { Session } from 'next-auth';
import { getSession } from '../../lib/auth';
import { buildOrgOverview, type Gap } from '../../lib/org-overview';
import { canManageEstate, canEditOrgProfile } from '../../lib/roles';
import DashboardShell from '../components/DashboardShell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '../components/ui/chart';
import { Pie, PieChart, Cell } from 'recharts';
import { AddSystemForm } from './components/AddSystemForm';
import { AddAccountablePersonForm } from './components/AddAccountablePersonForm';

export const metadata = { title: 'Organisation AI Overview | AIC' };
export const dynamic = 'force-dynamic';

/**
 * P0 per the PRD (section 7.1): "the single highest-risk technical claim in
 * the pitch... decide and state explicitly which of these AIC actually
 * means" before Friday, so an on-screen boundary claim survives a technical
 * follow-up rather than collapsing under one.
 *
 * NOT MY CALL TO MAKE SILENTLY - this is a claim made to an investor and an
 * insurer about how the product actually works, not a copy tweak. Defaulted
 * to (b), the client-scheduled export, because it is the one option that
 * needs no new provider-side integration to be true by Friday and nothing
 * here has built (a) or (c) yet. Zander: change this string (and only this
 * string) if that is not the mechanism you want to stand behind in the room.
 */
const READ_ONLY_MECHANISM =
  'Today, that means an export your own tooling already produces — a nightly file or webhook AIC ingests. AIC does not request or hold an API key for this.';

/**
 * Visual pass (Sep 2026): rebuilt on the shadcn primitives that were already
 * vendored in components/ui but unused here (Card, Badge, Avatar, Chart) -
 * see globals.css for the theme tokens those primitives needed and did not
 * have. Airier cards, generous radius, an avatar stack for accountable
 * persons, a real chart for the gap mix - all styled in AIC's own navy/gold,
 * not a generic reskin. Every field below is still the same buildOrgOverview
 * object; nothing about what this page reports or how it's gated changed,
 * only how it looks.
 */

const SEVERITY_DOT: Record<Gap['severity'], string> = {
  BLOCKING: 'bg-red-500',
  MATERIAL: 'bg-aic-gold',
  ADVISORY: 'bg-gray-400',
};

const SEVERITY_BADGE: Record<Gap['severity'], string> = {
  BLOCKING: 'bg-red-50 text-red-700 border-red-200',
  MATERIAL: 'bg-aic-copper-dim text-aic-navy border-aic-gold/30',
  ADVISORY: 'bg-gray-100 text-gray-600 border-gray-200',
};

const SEVERITY_LABEL: Record<Gap['severity'], string> = {
  BLOCKING: 'Blocks certification',
  MATERIAL: 'Material',
  ADVISORY: 'Advisory',
};

const SEVERITY_CHART_COLOR: Record<Gap['severity'], string> = {
  BLOCKING: '#ef4444',
  MATERIAL: '#c9920a',
  ADVISORY: '#94a3b8',
};

function SectionCard({
  title,
  note,
  action,
  className,
  children,
}: {
  title: string;
  note?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={`rounded-2xl border-gray-100 shadow-sm ${className ?? ''}`}>
      <CardHeader className="flex-row items-start justify-between gap-4 pb-4 border-b border-gray-50">
        <div>
          <CardTitle className="font-serif text-lg font-bold text-aic-navy">{title}</CardTitle>
          {note && <CardDescription className="mt-1 text-xs leading-relaxed">{note}</CardDescription>}
        </div>
        {action}
      </CardHeader>
      <CardContent className="pt-5">{children}</CardContent>
    </Card>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl bg-gray-50/80 border border-gray-100 px-4 py-3.5">
      <div className="font-mono text-[10px] font-bold text-gray-400 uppercase tracking-[0.14em]">
        {label}
      </div>
      <div className="mt-1 font-serif text-2xl font-bold text-aic-navy tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

function Tally({ rows }: { rows: Record<string, number> }) {
  const entries = Object.entries(rows);
  if (entries.length === 0) {
    return <p className="text-sm text-gray-400">Nothing recorded yet.</p>;
  }
  return (
    <dl className="space-y-2.5">
      {entries.map(([k, n]) => (
        <div key={k} className="flex items-center justify-between">
          <dt className="font-mono text-[11px] uppercase tracking-wider text-gray-500">
            {k.replace(/_/g, ' ')}
          </dt>
          <dd>
            <Badge variant="secondary" className="rounded-full font-mono tabular-nums px-2.5">
              {n}
            </Badge>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Overlapping avatar row + a "+N" badge, in the shape the reference brief asked for. */
function AvatarStack({ people }: { people: { name: string }[] }) {
  const shown = people.slice(0, 6);
  const initials = (name: string) =>
    name
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  const palette = ['bg-aic-navy', 'bg-[#3f8f83]', 'bg-aic-gold'];

  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <Avatar
          key={`${p.name}-${i}`}
          className="-ml-2.5 first:ml-0 ring-2 ring-white size-9"
          title={p.name}
        >
          <AvatarFallback className={`${palette[i % palette.length]} text-white text-xs font-bold`}>
            {initials(p.name)}
          </AvatarFallback>
        </Avatar>
      ))}
      {people.length > shown.length && (
        <div className="-ml-2.5 size-9 rounded-full bg-gray-100 ring-2 ring-white flex items-center justify-center text-[10px] font-bold text-gray-500">
          +{people.length - shown.length}
        </div>
      )}
    </div>
  );
}

function GapMixChart({ gaps }: { gaps: Gap[] }) {
  const counts: Record<Gap['severity'], number> = { BLOCKING: 0, MATERIAL: 0, ADVISORY: 0 };
  for (const g of gaps) counts[g.severity] += 1;
  const data = (Object.keys(counts) as Gap['severity'][])
    .filter((s) => counts[s] > 0)
    .map((s) => ({ severity: SEVERITY_LABEL[s], value: counts[s], key: s }));

  const config: ChartConfig = {
    value: { label: 'Gaps' },
    BLOCKING: { label: 'Blocking', color: SEVERITY_CHART_COLOR.BLOCKING },
    MATERIAL: { label: 'Material', color: SEVERITY_CHART_COLOR.MATERIAL },
    ADVISORY: { label: 'Advisory', color: SEVERITY_CHART_COLOR.ADVISORY },
  };

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[160px] text-center">
        <div className="size-12 rounded-full bg-green-50 border border-green-100 flex items-center justify-center text-green-600 text-lg font-bold">
          0
        </div>
        <p className="mt-3 text-xs text-gray-400">No open gaps.</p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-6">
      <ChartContainer config={config} className="h-[160px] w-[160px] aspect-square shrink-0">
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          <Pie data={data} dataKey="value" nameKey="severity" innerRadius={44} outerRadius={70} strokeWidth={3}>
            {data.map((d) => (
              <Cell key={d.key} fill={SEVERITY_CHART_COLOR[d.key]} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <ul className="space-y-2">
        {data.map((d) => (
          <li key={d.key} className="flex items-center gap-2 text-sm">
            <span className={`size-2.5 rounded-full ${SEVERITY_DOT[d.key]}`} />
            <span className="text-gray-600">{d.severity}</span>
            <span className="font-mono font-bold text-aic-navy tabular-nums">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const date = (v: unknown) =>
  v ? new Date(v as string).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export default async function OrgOverviewPage() {
  const session = (await getSession()) as Session | null;
  const orgId = session?.user?.orgId as string | undefined;
  const canDeclare = canManageEstate(session?.user?.role as string | undefined);
  const canDeclareAccountablePerson = canEditOrgProfile(session?.user?.role as string | undefined);

  if (!orgId) redirect('/login');

  const overview = await buildOrgOverview(orgId);

  if (!overview) {
    return (
      <DashboardShell>
        <div className="max-w-2xl mx-auto py-20 text-center">
          <h1 className="font-serif text-2xl font-bold text-aic-navy">Organisation not found</h1>
          <p className="mt-2 text-sm text-gray-500">
            This account is not attached to an organisation record.
          </p>
        </div>
      </DashboardShell>
    );
  }

  const { organisation, certificate, inventory, accountability, requirements, evidence, findings, decisions, corrections, usage, gaps } =
    overview;

  return (
    <DashboardShell>
      <div className="max-w-[1200px] mx-auto px-6 py-10 space-y-6">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] font-bold text-aic-gold uppercase tracking-[0.2em]">
              Organisation AI Overview
            </div>
            <h1 className="mt-2 font-serif text-3xl font-bold text-aic-navy tracking-tight">
              {organisation.name}
            </h1>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {organisation.divisionName && (
                <Badge className="rounded-full bg-aic-navy text-white hover:bg-aic-navy border-transparent">
                  Division {organisation.division} · {organisation.divisionName}
                </Badge>
              )}
              {organisation.standardVersion && (
                <Badge variant="outline" className="rounded-full border-gray-200 text-gray-500">
                  Standard {organisation.standardVersion}
                </Badge>
              )}
              {organisation.certificationStatus && (
                <Badge className="rounded-full bg-aic-gold text-aic-navy hover:bg-aic-gold border-transparent">
                  {organisation.certificationStatus}
                </Badge>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[10px] text-gray-400 uppercase tracking-[0.15em]">
              Assembled {new Date(overview.generatedAt).toLocaleString('en-ZA')}
            </div>
            {certificate && (
              <div className="mt-1 font-mono text-[11px] text-aic-navy">
                {certificate.number} · expires {date(certificate.expires)}
              </div>
            )}
          </div>
        </header>

        {/* P0: the boundary that makes AIC's position different from a platform
            that sits in the runtime path. Stated before the gaps, not after,
            because it is the answer to the question this whole screen invites
            ("so you're watching everything we do?") - no. */}
        <div className="rounded-2xl border border-aic-navy/10 bg-white px-5 py-4 shadow-sm">
          <div className="font-mono text-[10px] font-bold text-aic-navy uppercase tracking-[0.15em]">
            What AIC does not do
          </div>
          <p className="mt-1.5 text-sm text-gray-600 leading-relaxed max-w-3xl">
            AIC never holds your AI providers&apos; credentials — not even read-only,
            not even to itself — and never sits in the path that runs, blocks or
            approves anything your systems do. It records what you declare and
            compares it against what it can observe. {READ_ONLY_MECHANISM}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
          {/* Gaps lead. The counts below are context for these; on their own
              they change nothing about what anyone does next. */}
          <SectionCard
            title="What is missing"
            note="Observations drawn from your own records. AIC reports what it can see; it does not design the remedy."
          >
            {gaps.length === 0 ? (
              <p className="text-sm text-gray-600">
                No gaps detected in the records held. That is not the same as none existing — the
                completeness of the inventory is your declaration, not an inference.
              </p>
            ) : (
              <ul className="space-y-3">
                {gaps.map((gap) => (
                  <li key={gap.code} className="rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3.5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-2.5">
                        <span className={`mt-1.5 size-2 rounded-full shrink-0 ${SEVERITY_DOT[gap.severity]}`} />
                        <h3 className="text-sm font-bold text-aic-navy">{gap.title}</h3>
                      </div>
                      <Badge className={`rounded-full shrink-0 border ${SEVERITY_BADGE[gap.severity]}`}>
                        {SEVERITY_LABEL[gap.severity]}
                        {gap.count !== undefined ? ` · ${gap.count}` : ''}
                      </Badge>
                    </div>
                    <p className="mt-1.5 ml-4.5 text-xs leading-relaxed text-gray-500">{gap.detail}</p>
                    <div className="mt-1.5 ml-4.5 font-mono text-[9px] uppercase tracking-[0.15em] text-gray-300">
                      {gap.code}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Gap mix" note="Blocking gaps prevent certification; the rest are context.">
            <GapMixChart gaps={gaps} />
          </SectionCard>
        </div>

        <SectionCard
          title="AI inventory"
          note="Every system this organisation has declared. Completeness is a declaration; nothing here is discovered automatically."
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-6 mb-6 border-b border-gray-50">
            <StatTile label="Declared" value={inventory.total} />
            <StatTile label="In production" value={inventory.inProduction} />
            <StatTile label="Sandbox" value={inventory.inSandbox} />
            <StatTile
              label="Logging decisions"
              value={decisions.systemsLoggingDecisions}
              sub={inventory.undeclaredButDeciding.length > 0 ? `${inventory.undeclaredButDeciding.length} undeclared` : undefined}
            />
          </div>

          {canDeclare && (
            <div className="mb-5">
              <AddSystemForm />
            </div>
          )}

          {inventory.systems.length === 0 ? (
            <p className="text-sm text-gray-400">
              {canDeclare
                ? 'No systems declared yet.'
                : 'No systems declared yet. Ask an administrator or compliance officer to add one.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left font-mono text-[10px] uppercase tracking-[0.15em] text-gray-400 border-b border-gray-100">
                    <th className="pb-2 pr-4 font-bold">System</th>
                    <th className="pb-2 pr-4 font-bold">Purpose</th>
                    <th className="pb-2 pr-4 font-bold">Risk tier</th>
                    <th className="pb-2 pr-4 font-bold">Lifecycle</th>
                    <th className="pb-2 font-bold">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {inventory.systems.map((s) => (
                    <tr key={s.id} className="align-top">
                      <td className="py-3 pr-4">
                        <div className="font-bold text-aic-navy">{s.name}</div>
                        <div className="font-mono text-[10px] text-gray-400">v{s.version}</div>
                      </td>
                      <td className="py-3 pr-4 max-w-md text-gray-600">
                        {s.purpose?.trim() || <span className="text-red-500">Not stated</span>}
                      </td>
                      <td className="py-3 pr-4 font-mono tabular-nums text-gray-600">{s.riskTier}</td>
                      <td className="py-3 pr-4">
                        <Badge variant="outline" className="rounded-full border-gray-200 font-mono text-[10px] uppercase tracking-wider text-gray-500">
                          {s.lifecycleStage}
                        </Badge>
                      </td>
                      <td className="py-3 font-mono text-[11px] text-gray-400">{date(s.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectionCard
            title="Accountability"
            note="A named individual who has accepted a declaration. A job title alone is not an accountable person."
          >
            {accountability.persons.length === 0 ? (
              <p className="text-sm text-red-600 mb-3">No current declaration on record.</p>
            ) : (
              <>
                <div className="mb-4">
                  <AvatarStack people={accountability.persons.map((p) => ({ name: p.name }))} />
                </div>
                <ul className="divide-y divide-gray-50 mb-3">
                  {accountability.persons.map((p) => (
                    <li key={p.id} className="py-3">
                      <div className="font-bold text-aic-navy text-sm">{p.name}</div>
                      <div className="text-xs text-gray-500">{p.jobTitle ?? 'No title recorded'}</div>
                      <div className="mt-1 font-mono text-[10px] text-gray-400 uppercase tracking-wider">
                        Declaration {p.declarationVersion} accepted {date(p.declarationAcceptedAt)}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {canDeclareAccountablePerson ? (
              <AddAccountablePersonForm />
            ) : accountability.persons.length === 0 ? (
              <p className="text-xs text-gray-400">
                Ask an administrator or compliance officer to declare one.
              </p>
            ) : null}
          </SectionCard>

          <SectionCard
            title="Decision activity"
            note="What the logging API has received. Absence of records is not evidence that no decisions were made."
          >
            <div className="grid grid-cols-2 gap-4">
              <StatTile label="Decisions recorded" value={decisions.recorded.toLocaleString('en-ZA')} />
              <StatTile
                label="Human overrides"
                value={decisions.humanOverrides.toLocaleString('en-ZA')}
                sub={
                  decisions.humanOverrideRate !== null
                    ? `${(decisions.humanOverrideRate * 100).toFixed(2)}% of ${decisions.recorded.toLocaleString('en-ZA')}`
                    : 'No denominator yet'
                }
              />
            </div>
            <div className="mt-6 pt-4 border-t border-gray-50 font-mono text-[10px] uppercase tracking-[0.15em] text-gray-400">
              Last record {date(decisions.lastRecordedAt)}
            </div>
          </SectionCard>

          <SectionCard
            title="Provider &amp; model usage"
            note="Spend and volume as reported by your own tooling - a nightly export or webhook. AIC never calls a provider directly."
          >
            {usage.byProviderModel.length === 0 ? (
              <p className="text-sm text-gray-400">No usage reported yet.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 pb-5 mb-5 border-b border-gray-50">
                  <StatTile label="Providers reporting" value={usage.providers} />
                  <StatTile
                    label="Total spend"
                    value={`$${usage.totalCostUsd.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left font-mono text-[10px] uppercase tracking-[0.15em] text-gray-400 border-b border-gray-100">
                        <th className="pb-2 pr-4 font-bold">Provider</th>
                        <th className="pb-2 pr-4 font-bold">Model</th>
                        <th className="pb-2 pr-4 font-bold text-right">Requests</th>
                        <th className="pb-2 pr-4 font-bold text-right">Tokens</th>
                        <th className="pb-2 font-bold text-right">Spend</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {usage.byProviderModel.map((u, i) => (
                        <tr key={`${u.provider}-${u.model ?? 'unspecified'}-${i}`}>
                          <td className="py-2.5 pr-4 font-medium text-aic-navy">{u.provider}</td>
                          <td className="py-2.5 pr-4 text-gray-600">{u.model ?? '—'}</td>
                          <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-gray-600">
                            {u.requests.toLocaleString('en-ZA')}
                          </td>
                          <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-gray-600">
                            {(u.inputTokens + u.outputTokens).toLocaleString('en-ZA')}
                          </td>
                          <td className="py-2.5 text-right font-mono tabular-nums text-aic-navy">
                            ${u.costUsd.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <div className="mt-5 pt-4 border-t border-gray-50 font-mono text-[10px] uppercase tracking-[0.15em] text-gray-400">
              Last reported {date(usage.lastIngestedAt)}
            </div>
          </SectionCard>

          <SectionCard title="Requirements" note={`Against standard ${organisation.standardVersion ?? '—'}.`}>
            <Tally rows={requirements.byStatus} />
          </SectionCard>

          <SectionCard title="Evidence" note={`Last verified ${date(evidence.lastVerifiedAt)}.`}>
            <Tally rows={evidence.byVerificationOutcome} />
          </SectionCard>

          <SectionCard title="Open findings" note={`${findings.overdueCount} past their response date.`}>
            {findings.open.length === 0 ? (
              <p className="text-sm text-gray-400">No open findings.</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {findings.open.slice(0, 10).map((f) => (
                  <li key={f.id} className="py-3 flex items-baseline justify-between gap-4">
                    <div>
                      <div className="text-sm text-aic-navy">{f.title}</div>
                      <div className="font-mono text-[10px] uppercase tracking-wider text-gray-400">
                        {f.severity} · raised {date(f.raisedAt)}
                      </div>
                    </div>
                    {f.overdue && (
                      <Badge className="rounded-full bg-red-50 text-red-600 border-red-200 shrink-0">
                        Overdue
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Correction requests" note="Raised by data subjects under the Correction right.">
            <Tally rows={corrections.byStatus} />
          </SectionCard>
        </div>

        <footer className="pt-6 border-t border-gray-100">
          <p className="text-xs text-gray-500 leading-relaxed max-w-3xl">{overview.scope}</p>
        </footer>
      </div>
    </DashboardShell>
  );
}
