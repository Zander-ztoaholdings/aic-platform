import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Session } from 'next-auth';
import { getSession } from '../../lib/auth';
import { buildOrgOverview, type Gap } from '../../lib/org-overview';
import DashboardShell from '../components/DashboardShell';

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

const SEVERITY_STYLE: Record<Gap['severity'], string> = {
  BLOCKING: 'border-red-200 bg-red-50 text-red-900',
  MATERIAL: 'border-amber-200 bg-amber-50 text-amber-900',
  ADVISORY: 'border-slate-200 bg-slate-50 text-slate-700',
};

const SEVERITY_LABEL: Record<Gap['severity'], string> = {
  BLOCKING: 'Blocks certification',
  MATERIAL: 'Material',
  ADVISORY: 'Advisory',
};

function Panel({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg">
      <header className="px-6 py-4 border-b border-gray-100">
        <h2 className="font-serif text-lg font-bold text-aic-navy">{title}</h2>
        {note && <p className="mt-1 text-xs text-gray-500 leading-relaxed">{note}</p>}
      </header>
      <div className="p-6">{children}</div>
    </section>
  );
}

function Figure({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em]">
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
    <dl className="divide-y divide-gray-100">
      {entries.map(([k, n]) => (
        <div key={k} className="flex items-baseline justify-between py-2">
          <dt className="font-mono text-[11px] uppercase tracking-wider text-gray-500">
            {k.replace(/_/g, ' ')}
          </dt>
          <dd className="font-mono text-sm font-bold text-aic-navy tabular-nums">{n}</dd>
        </div>
      ))}
    </dl>
  );
}

const date = (v: unknown) =>
  v ? new Date(v as string).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export default async function OrgOverviewPage() {
  const session = (await getSession()) as Session | null;
  const orgId = session?.user?.orgId as string | undefined;

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

  const { organisation, certificate, inventory, accountability, requirements, evidence, findings, decisions, corrections, gaps } =
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
            <p className="mt-1 text-xs text-gray-500">
              {organisation.divisionName
                ? `Division ${organisation.division} — ${organisation.divisionName}`
                : 'Division not set'}
              {organisation.standardVersion ? ` · Standard ${organisation.standardVersion}` : ''}
              {organisation.certificationStatus ? ` · ${organisation.certificationStatus}` : ''}
            </p>
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
        <div className="rounded-lg border border-aic-navy/15 bg-aic-navy/[0.03] px-5 py-4">
          <div className="font-mono text-[10px] font-bold text-aic-navy uppercase tracking-[0.15em]">
            What AIC does not do
          </div>
          <p className="mt-1.5 text-sm text-aic-navy leading-relaxed max-w-3xl">
            AIC never holds your AI providers&apos; credentials — not even read-only,
            not even to itself — and never sits in the path that runs, blocks or
            approves anything your systems do. It records what you declare and
            compares it against what it can observe. {READ_ONLY_MECHANISM}
          </p>
        </div>

        {/* Gaps lead. The counts below are context for these; on their own they
            change nothing about what anyone does next. */}
        <Panel
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
                <li key={gap.code} className={`border rounded-md px-4 py-3 ${SEVERITY_STYLE[gap.severity]}`}>
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="text-sm font-bold">{gap.title}</h3>
                    <span className="font-mono text-[9px] font-bold uppercase tracking-[0.15em] shrink-0">
                      {SEVERITY_LABEL[gap.severity]}
                      {gap.count !== undefined ? ` · ${gap.count}` : ''}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed opacity-90">{gap.detail}</p>
                  <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.15em] opacity-50">
                    {gap.code}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="AI inventory"
          note="Every system this organisation has declared. Completeness is a declaration; nothing here is discovered automatically."
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pb-6 mb-6 border-b border-gray-100">
            <Figure label="Declared" value={inventory.total} />
            <Figure label="In production" value={inventory.inProduction} />
            <Figure label="Sandbox" value={inventory.inSandbox} />
            <Figure
              label="Logging decisions"
              value={decisions.systemsLoggingDecisions}
              sub={inventory.undeclaredButDeciding.length > 0 ? `${inventory.undeclaredButDeciding.length} undeclared` : undefined}
            />
          </div>

          {inventory.systems.length === 0 ? (
            <p className="text-sm text-gray-400">
              No systems declared.{' '}
              <Link href="/workspace" className="text-aic-gold underline">
                Add the first one
              </Link>
              .
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
                      <td className="py-3 pr-4 font-mono text-[11px] uppercase tracking-wider text-gray-500">
                        {s.lifecycleStage}
                      </td>
                      <td className="py-3 font-mono text-[11px] text-gray-400">{date(s.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Panel
            title="Accountability"
            note="A named individual who has accepted a declaration. A job title alone is not an accountable person."
          >
            {accountability.persons.length === 0 ? (
              <p className="text-sm text-red-600">No current declaration on record.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
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
            )}
          </Panel>

          <Panel
            title="Decision activity"
            note="What the logging API has received. Absence of records is not evidence that no decisions were made."
          >
            <div className="grid grid-cols-2 gap-6">
              <Figure label="Decisions recorded" value={decisions.recorded.toLocaleString('en-ZA')} />
              <Figure
                label="Human overrides"
                value={decisions.humanOverrides.toLocaleString('en-ZA')}
                sub={
                  decisions.humanOverrideRate !== null
                    ? `${(decisions.humanOverrideRate * 100).toFixed(2)}% of ${decisions.recorded.toLocaleString('en-ZA')}`
                    : 'No denominator yet'
                }
              />
            </div>
            <div className="mt-6 pt-4 border-t border-gray-100 font-mono text-[10px] uppercase tracking-[0.15em] text-gray-400">
              Last record {date(decisions.lastRecordedAt)}
            </div>
          </Panel>

          <Panel title="Requirements" note={`Against standard ${organisation.standardVersion ?? '—'}.`}>
            <Tally rows={requirements.byStatus} />
          </Panel>

          <Panel
            title="Evidence"
            note={`Last verified ${date(evidence.lastVerifiedAt)}.`}
          >
            <Tally rows={evidence.byVerificationOutcome} />
          </Panel>

          <Panel title="Open findings" note={`${findings.overdueCount} past their response date.`}>
            {findings.open.length === 0 ? (
              <p className="text-sm text-gray-400">No open findings.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {findings.open.slice(0, 10).map((f) => (
                  <li key={f.id} className="py-3 flex items-baseline justify-between gap-4">
                    <div>
                      <div className="text-sm text-aic-navy">{f.title}</div>
                      <div className="font-mono text-[10px] uppercase tracking-wider text-gray-400">
                        {f.severity} · raised {date(f.raisedAt)}
                      </div>
                    </div>
                    {f.overdue && (
                      <span className="font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-red-600 shrink-0">
                        Overdue
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Correction requests" note="Raised by data subjects under the Correction right.">
            <Tally rows={corrections.byStatus} />
          </Panel>
        </div>

        <footer className="pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 leading-relaxed max-w-3xl">{overview.scope}</p>
        </footer>
      </div>
    </DashboardShell>
  );
}
