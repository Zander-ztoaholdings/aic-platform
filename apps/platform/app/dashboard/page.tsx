import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Session } from 'next-auth';
import { getSession } from '../../lib/auth';
import { readContinuity } from '../../lib/continuity-store';
import { buildOrgOverview } from '../../lib/org-overview';
import type { ChainLink, Drift } from '../../lib/continuity';
import DashboardShell from '../components/DashboardShell';
import { ObserveButton } from './components/ObserveButton';

export const metadata = { title: 'Continuity Record | AIC' };
export const dynamic = 'force-dynamic';

/**
 * This page replaced a mock.
 *
 * It previously rendered a hardcoded integrity score of 77, five invented
 * rights scores and an "Example Organisation" — convincing enough to demo and
 * worth nothing to a client, who would have discovered within a week that the
 * only number on their dashboard was a constant. It now reads the continuity
 * record, which is the actual product: an unbroken account of what AI the
 * organisation was running, who was accountable for it, and what changed.
 */

const DAY = 24 * 60 * 60 * 1000;

const CHANGE_VERB: Record<string, string> = {
  DECLARED: 'declared',
  CHANGED: 'changed',
  WITHDRAWN: 'withdrawn',
  OBSERVED: 'observed by AIC',
};

const ENTITY_LABEL: Record<string, string> = {
  AI_SYSTEM: 'System',
  ACCOUNTABLE_PERSON: 'Accountable person',
  FINDING: 'Finding',
  CERTIFICATE: 'Certificate',
  UNDECLARED_SYSTEM: 'Undeclared system',
};

const SEVERITY_STYLE: Record<Drift['severity'], string> = {
  BLOCKING: 'border-red-200 bg-red-50 text-red-900',
  MATERIAL: 'border-amber-200 bg-amber-50 text-amber-900',
  ADVISORY: 'border-slate-200 bg-slate-50 text-slate-700',
};

function ago(iso: string, now: number) {
  const d = Math.floor((now - new Date(iso).getTime()) / DAY);
  if (d <= 0) {
    const h = Math.floor((now - new Date(iso).getTime()) / (60 * 60 * 1000));
    return h <= 0 ? 'just now' : `${h}h ago`;
  }
  return d === 1 ? 'yesterday' : `${d}d ago`;
}

function describe(e: ChainLink) {
  const verb = CHANGE_VERB[e.changeType] ?? e.changeType.toLowerCase();
  if (e.changeType === 'CHANGED' && e.field) {
    return `${e.field}: ${e.previousValue ?? '—'} → ${e.newValue ?? '—'}`;
  }
  if (e.changeType === 'OBSERVED' && e.field === 'decisions') {
    return e.previousValue
      ? `decisions logged: ${e.previousValue} → ${e.newValue}`
      : `${e.newValue} decisions logged, never declared`;
  }
  if (e.changeType === 'DECLARED' && e.newValue) return `${e.field}: ${e.newValue}`;
  return verb;
}

function EventRow({ e, now }: { e: ChainLink; now: number }) {
  const emphatic = e.entityType === 'UNDECLARED_SYSTEM' || e.changeType === 'WITHDRAWN';
  return (
    <li className="py-3 flex items-start gap-4">
      <span className="font-mono text-[10px] text-gray-300 tabular-nums pt-0.5 w-12 shrink-0">
        #{e.seq}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-gray-400">
            {ENTITY_LABEL[e.entityType] ?? e.entityType}
          </span>
          <span className={`text-sm font-bold ${emphatic ? 'text-red-700' : 'text-aic-navy'}`}>
            {e.entityLabel}
          </span>
        </div>
        <div className="mt-0.5 text-xs text-gray-600 break-words">{describe(e)}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-mono text-[10px] text-gray-400">{ago(e.observedAt, now)}</div>
        <div className="font-mono text-[9px] text-gray-300 truncate max-w-[10rem]">{e.actorLabel}</div>
      </div>
    </li>
  );
}

export default async function ContinuityDashboard() {
  const session = (await getSession()) as Session | null;
  const orgId = session?.user?.orgId as string | undefined;
  if (!orgId) redirect('/login');

  const [record, overview] = await Promise.all([
    readContinuity(orgId, 40),
    buildOrgOverview(orgId),
  ]);

  const now = Date.now();
  const firstRun = record.total === 0;
  const chainOk = record.chain.valid;

  return (
    <DashboardShell>
      <div className="max-w-[1100px] mx-auto px-6 py-10 space-y-6">
        <header className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div>
            <div className="font-mono text-[10px] font-bold text-aic-gold uppercase tracking-[0.2em]">
              Continuity Record
            </div>
            <h1 className="mt-2 font-serif text-3xl font-bold text-aic-navy tracking-tight">
              {overview?.organisation.name ?? 'Your organisation'}
            </h1>
            <p className="mt-2 text-sm text-gray-600 max-w-xl leading-relaxed">
              {firstRun
                ? 'Nothing recorded yet. The first observation sets the opening balance — every AI system you have declared, everyone accountable for one, and the state each is in today.'
                : `${record.total} change${record.total === 1 ? '' : 's'} recorded since ${new Date(
                    record.since!
                  ).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}.`}
            </p>
          </div>
          <ObserveButton firstRun={firstRun} />
        </header>

        {!firstRun && (
          <div
            className={`rounded-lg border px-5 py-4 ${
              chainOk ? 'border-emerald-200 bg-emerald-50' : 'border-red-300 bg-red-50'
            }`}
          >
            <div className="flex items-baseline justify-between gap-4 flex-wrap">
              <span
                className={`font-mono text-[10px] font-bold uppercase tracking-[0.2em] ${
                  chainOk ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                {chainOk ? 'Chain intact' : `Chain broken at #${record.chain.brokenAtSeq}`}
              </span>
              <span className="font-mono text-[10px] text-gray-500">
                {record.total} links verified
                {record.lastObservedAt
                  ? ` · last observed ${ago(record.lastObservedAt, now)}`
                  : ''}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-600 leading-relaxed max-w-3xl">
              {chainOk
                ? 'Every entry has been recomputed from its own contents and matches the link before it. The record is append-only at the database level, so an entry cannot be edited or removed — a correction is an additional entry and both stay visible.'
                : `${record.chain.reason}. This record can no longer be relied on from that point forward and AIC should be told.`}
            </p>
          </div>
        )}

        {record.drift.length > 0 && (
          <section className="bg-white border border-gray-200 rounded-lg">
            <header className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-serif text-lg font-bold text-aic-navy">What has drifted</h2>
              <p className="mt-1 text-xs text-gray-500">
                Conditions that have gone stale or that the record now contradicts. AIC reports
                what it sees; deciding what to do about it is yours.
              </p>
            </header>
            <ul className="p-6 space-y-3">
              {record.drift.map((d, i) => (
                <li
                  key={`${d.code}-${i}`}
                  className={`border rounded-md px-4 py-3 ${SEVERITY_STYLE[d.severity]}`}
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="text-sm font-bold">{d.title}</h3>
                    <span className="font-mono text-[9px] font-bold uppercase tracking-[0.15em] shrink-0">
                      {d.severity}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed opacity-90">{d.detail}</p>
                  <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.15em] opacity-50">
                    {d.code}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="bg-white border border-gray-200 rounded-lg">
          <header className="px-6 py-4 border-b border-gray-100 flex items-baseline justify-between gap-4">
            <div>
              <h2 className="font-serif text-lg font-bold text-aic-navy">The record</h2>
              <p className="mt-1 text-xs text-gray-500">
                Newest first. Each entry names what changed, what it changed from, and who changed
                it.
              </p>
            </div>
            <Link
              href="/overview"
              className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-aic-gold hover:underline shrink-0"
            >
              Current estate →
            </Link>
          </header>
          <div className="px-6 pb-2">
            {firstRun ? (
              <p className="py-10 text-sm text-gray-400 text-center">
                No entries yet.
              </p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {record.events.map((e) => (
                  <EventRow key={e.seq} e={e} now={now} />
                ))}
              </ul>
            )}
          </div>
          {record.total > record.events.length && (
            <footer className="px-6 py-3 border-t border-gray-100 font-mono text-[10px] text-gray-400 uppercase tracking-[0.15em]">
              Showing the most recent {record.events.length} of {record.total}
            </footer>
          )}
        </section>

        <footer className="pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 leading-relaxed max-w-3xl">
            This record covers what has been declared to AIC and what AIC has observed in the
            decision log. It is not a determination of legal compliance in any jurisdiction, and
            the completeness of the AI inventory remains a declaration by the organisation.
          </p>
        </footer>
      </div>
    </DashboardShell>
  );
}
