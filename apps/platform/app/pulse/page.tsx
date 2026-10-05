'use client';
import { PageHeader } from '@/app/components/ui/PageHeader';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { Activity, ShieldCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import DashboardShell from '../components/DashboardShell';
import { ReviewQueue } from './ReviewQueue';
import { OverridePanel } from './OverridePanel';
import { outcomeOptions, reasonOptions, outcomeLabel } from '@/lib/override';
import { Fragment } from 'react';
import { SectionCard } from '../components/ui/Eyebrow';
import { canRecordDecisions } from '../../lib/roles';

/**
 * The decision log.
 *
 * POST /api/decisions and GET /api/decisions were fully built - session or
 * `aic_live_` API-key auth, a deliberate rule that only a signed-in person
 * (never a key) may record a human override - and had no UI at all; this
 * page was a static "Coming Soon" card. That gap mattered more than most of
 * the others like it: the override ledger is the evidence behind HU-2 (a
 * human was answerable for the outcome), and it is the client-facing half of
 * Guild's "centralised governance" function as AIC's version of it records -
 * see AIC - Org AI Overview & Insurer Feed Scope §4b.1: "Guild proves the
 * agent did what it was told. We prove a person was answerable for it."
 *
 * Machine-recorded decisions (from an integration using an API key) show up
 * here automatically. This page's own write path - the form below - is for
 * the case a key cannot cover: a person reviewing a decision after the fact
 * and recording that they overrode it, with a reason.
 */

type Decision = {
  id: string;
  systemName: string;
  inputParams: unknown;
  outcome: unknown;
  explanation: string | null;
  isHumanOverride: boolean;
  overrideReason: string | null;
  overriddenBy: string | null;
  createdAt: string;
  reviewStatus?: string;
  finalOutcome?: unknown;
  externalRef?: string | null;
};

type AiSystem = { id: string; name: string };

function summarize(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>;
    if (typeof v.decision === 'string') return v.decision;
  }
  try {
    const s = JSON.stringify(value);
    return s.length > 80 ? s.slice(0, 80) + '…' : s;
  } catch {
    return String(value);
  }
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div>
      <div className="text-[12px] font-bold text-gray-400 first-cap">{label}</div>
      <div className="mt-1 font-serif text-2xl font-bold text-aic-navy tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

export default function PulsePage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const canOverride = canRecordDecisions(role);

  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [systems, setSystems] = useState<AiSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [overriding, setOverriding] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [systemName, setSystemName] = useState('');
  const [originalOutcome, setOriginalOutcome] = useState('');
  const [outcome, setOutcome] = useState('');
  const [overrideReason, setOverrideReason] = useState('');

  const load = async () => {
    try {
      const [dRes, sRes] = await Promise.all([fetch('/api/decisions'), fetch('/api/ai-systems')]);
      const dData = await dRes.json();
      const sData = await sRes.json();
      setDecisions(dData.decisions || []);
      setSystems(sData.systems || []);
    } catch {
      toast.error('Failed to load the decision log.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const total = decisions.length;
    const overrides = decisions.filter((d) => d.isHumanOverride).length;
    return {
      total,
      overrides,
      rate: total > 0 ? `${((overrides / total) * 100).toFixed(1)}% of ${total}` : 'No decisions yet',
      last: decisions[0]?.createdAt ?? null,
    };
  }, [decisions]);

  const resetForm = () => {
    setSystemName('');
    setOriginalOutcome('');
    setOutcome('');
    setOverrideReason('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!systemName.trim() || !outcome.trim() || !overrideReason.trim()) {
      toast.error('System, what happened instead, and a reason are all required.');
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        system_name: systemName.trim(),
        input_params: { note: 'Recorded manually via the Decision Log' },
        outcome: { decision: outcome.trim() },
        isHumanOverride: true,
        overrideReason: overrideReason.trim(),
      };
      if (originalOutcome.trim()) {
        body.originalOutcome = { decision: originalOutcome.trim() };
      }

      const res = await fetch('/api/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as { error?: string });
        throw new Error(data.error || 'Failed to record the override.');
      }

      toast.success('Override recorded.');
      resetForm();
      setFormOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record the override.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-5">
        <div>
          <PageHeader eyebrow="AI overview" title="Decision log" lede="Decisions your systems have recorded, the human overrides, and who made them." />
        </div>

        <ReviewQueue history={decisions} onChange={load} />

        <SectionCard>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            <Stat label="Recorded" value={loading ? '—' : stats.total} />
            <Stat label="Human overrides" value={loading ? '—' : stats.overrides} sub={loading ? undefined : stats.rate} />
            <Stat label="Last recorded" value={loading ? '—' : timeAgo(stats.last)} />
            <Stat label="Systems in log" value={loading ? '—' : new Set(decisions.map((d) => d.systemName)).size} />
          </div>
        </SectionCard>

        <SectionCard className="!p-0 overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <p className="text-sm">Loading the decision log…</p>
            </div>
          ) : decisions.length === 0 ? (
            <div className="text-center py-16">
              <Activity className="w-8 h-8 text-gray-300 mx-auto mb-3" />
              <h2 className="text-sm font-bold text-aic-navy mb-1">Nothing recorded yet</h2>
              <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
                Decisions arrive here as your systems send them to AIC. Each one can be overridden from its row,
                in two taps.
              </p>
            </div>
          ) : (
            <>
            {/* Phones: one card per decision, so the override panel has the full width. */}
            <ul className="md:hidden divide-y divide-gray-100">
              {decisions.map((d) => (
                <li key={d.id} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-aic-navy break-words">{d.systemName}</div>
                      <div className="mt-0.5 text-sm text-gray-600">{summarize(d.outcome)} <span className="text-[11px] text-gray-400">· {timeAgo(d.createdAt)}</span></div>
                    </div>
                    {canOverride && !d.isHumanOverride && d.reviewStatus !== 'pending' && d.reviewStatus !== 'expired' && overriding !== d.id && (
                      <button type="button" onClick={() => setOverriding(d.id)} className="inline-flex h-10 shrink-0 items-center rounded-full border border-[#dde2e8] bg-white px-4 text-[13px] font-medium text-[#0e1b2c]">Override</button>
                    )}
                  </div>
                  {d.isHumanOverride && (
                    <div className="mt-2">
                      <span className="text-[12px] font-bold first-cap text-amber-700 bg-amber-50 px-2 py-0.5 rounded">Overridden{outcomeLabel(d.finalOutcome) ? ` to ${outcomeLabel(d.finalOutcome)}` : ''}</span>
                      {d.overrideReason && <div className="text-xs text-gray-500 mt-1">{d.overrideReason}</div>}
                    </div>
                  )}
                  {overriding === d.id && (
                    <div className="mt-3">
                      <OverridePanel id={d.id} original={d.outcome} outcomes={outcomeOptions(decisions, d.systemName, d.outcome)} reasons={reasonOptions(decisions, d.systemName)}
                        onDone={() => { setOverriding(null); toast.success('Override recorded.'); load(); }} onCancel={() => setOverriding(null)} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[12px] first-cap text-gray-400 border-b border-gray-100">
                    <th className="px-5 py-3 font-bold">System</th>
                    <th className="px-5 py-3 font-bold">Outcome</th>
                    <th className="px-5 py-3 font-bold">Override</th>
                    <th className="px-5 py-3 font-bold">Recorded</th>
                    {canOverride && <th className="px-5 py-3"><span className="sr-only">Actions</span></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {decisions.map((d) => (
                    <Fragment key={d.id}>
                    <tr className="align-top">
                      <td className="px-5 py-3 font-bold text-aic-navy">{d.systemName}</td>
                      <td className="px-5 py-3 max-w-md text-gray-600">
                        {summarize(d.outcome)}
                        {d.explanation && <div className="text-xs text-gray-400 mt-0.5">{d.explanation}</div>}
                      </td>
                      <td className="px-5 py-3">
                        {d.isHumanOverride ? (
                          <div>
                            <span className="text-[12px] font-bold first-cap text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                              Overridden{outcomeLabel(d.finalOutcome) ? ` to ${outcomeLabel(d.finalOutcome)}` : ''}
                            </span>
                            {d.overrideReason && (
                              <div className="text-xs text-gray-500 mt-1 max-w-xs">{d.overrideReason}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 font-mono text-[11px] text-gray-400 whitespace-nowrap">
                        {timeAgo(d.createdAt)}
                      </td>
                      {canOverride && (
                        <td className="px-5 py-2 text-right">
                          {!d.isHumanOverride && d.reviewStatus !== 'pending' && d.reviewStatus !== 'expired' && overriding !== d.id && (
                            <button type="button" onClick={() => setOverriding(d.id)} className="inline-flex h-9 items-center rounded-full border border-[#dde2e8] bg-white px-3.5 text-[13px] font-medium text-[#0e1b2c] hover:border-[#a8772a]">Override</button>
                          )}
                        </td>
                      )}
                    </tr>
                    {overriding === d.id && (
                      <tr>
                        <td colSpan={5} className="px-5 pb-4">
                          <OverridePanel id={d.id} original={d.outcome} outcomes={outcomeOptions(decisions, d.systemName, d.outcome)} reasons={reasonOptions(decisions, d.systemName)}
                            onDone={() => { setOverriding(null); toast.success('Override recorded.'); load(); }} onCancel={() => setOverriding(null)} />
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </SectionCard>
        {canOverride && (
          <SectionCard>
            {!formOpen ? (
              <button
                type="button"
                onClick={() => setFormOpen(true)}
                className="flex items-center gap-2 font-mono text-xs font-bold text-[#c9920a] hover:text-aic-navy transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5" /> Record an override for a decision that is not in the log
              </button>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-[12px] font-bold text-aic-navy first-cap">
                    Record a human override
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      resetForm();
                      setFormOpen(false);
                    }}
                    className="text-xs font-mono text-gray-400 hover:text-gray-600"
                  >
                    Cancel
                  </button>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed max-w-xl">
                  Only for a decision your systems did not send to AIC. If it is in the log below, press
                  <strong> Override</strong> on its row instead: the system and outcome are already filled in.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="dec-system" className="block text-[12px] font-bold first-cap text-gray-400 mb-1.5">
                      System
                    </label>
                    <input
                      id="dec-system"
                      list="dec-systems-list"
                      required
                      value={systemName}
                      onChange={(e) => setSystemName(e.target.value)}
                      placeholder="e.g. fraud-scoring-agent"
                      className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-aic-navy focus:outline-none focus:border-aic-gold transition-colors bg-white"
                    />
                    <datalist id="dec-systems-list">
                      {systems.map((s) => (
                        <option key={s.id} value={s.name} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label htmlFor="dec-original" className="block text-[12px] font-bold first-cap text-gray-400 mb-1.5">
                      What the system decided
                    </label>
                    <input
                      id="dec-original"
                      value={originalOutcome}
                      onChange={(e) => setOriginalOutcome(e.target.value)}
                      placeholder="e.g. declined the claim"
                      className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-aic-navy focus:outline-none focus:border-aic-gold transition-colors bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="dec-outcome" className="block text-[12px] font-bold first-cap text-gray-400 mb-1.5">
                    What you decided instead
                  </label>
                  <input
                    id="dec-outcome"
                    required
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value)}
                    placeholder="e.g. approved the claim after reviewing the supporting documents"
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-aic-navy focus:outline-none focus:border-aic-gold transition-colors bg-white"
                  />
                </div>

                <div>
                  <label htmlFor="dec-reason" className="block text-[12px] font-bold first-cap text-gray-400 mb-1.5">
                    Why
                  </label>
                  <textarea
                    id="dec-reason"
                    required
                    rows={2}
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="What made this case an exception."
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-aic-navy focus:outline-none focus:border-aic-gold transition-colors bg-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-aic-navy text-white rounded-md px-4 py-2 text-xs font-bold first-cap disabled:opacity-50"
                >
                  {submitting ? 'Recording…' : 'Record override'}
                </button>
              </form>
            )}
          </SectionCard>
        )}

      </div>
    </DashboardShell>
  );
}
