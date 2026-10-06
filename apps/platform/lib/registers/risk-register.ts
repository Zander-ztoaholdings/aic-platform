/**
 * The risk register as the page shows it: what people recorded, with what
 * the evidence says next to it, and what AIC noticed that nothing on the
 * register covers yet.
 *
 * When the computed current score of a risk moves, it is recorded as a
 * 'signal' event, so the history shows when the evidence changed. What a
 * person recorded (likelihood, impact, target, treatment) is never changed.
 */
import { getTenantDb, risks, eq, desc } from '@aic/db';
import { COMMON_BY_KEY } from '../common-controls';
import { inherent, target, current, acceptanceExpired, heatmap, type ScoreView } from './risk';
import { deriveSignals, suggestions, liveStatus, type Signal, type Suggestion, type LiveStatus, type RegisterRisk } from './risk-signals';
import { observe, loadTracking, loadDismissals, lastCurrentScores, recordEvents, type Tracking } from './risk-observe';

type Row = typeof risks.$inferSelect;

export type RegisterEntry = Row & Partial<Tracking> & {
  inherent: ScoreView; target: ScoreView | null; current: ScoreView & { raisedBy: number; basis: number };
  /** Kept for older callers: the inherent score and level. */
  score: number; level: ScoreView['level']; residualScore: number | null;
  overdue: boolean; acceptanceExpired: boolean; live: LiveStatus;
};

export type Register = {
  risks: RegisterEntry[];
  suggestions: Suggestion[];
  signals: Signal[];
  dismissed: number;
  /** False until migration 018 is applied: no history, no dismissals, no links. */
  live: boolean;
  heatmap: { inherent: number[][]; current: number[][] };
};

const title = (k: string) => COMMON_BY_KEY[k]?.title ?? k;

export async function buildRegister(orgId: string, now = new Date()): Promise<Register> {
  const rows = await getTenantDb(orgId).query((tx) => tx.select().from(risks).where(eq(risks.orgId, orgId)).orderBy(desc(risks.updatedAt)));
  const [tracking, observed, dismissals] = await Promise.all([loadTracking(orgId), observe(orgId, now), loadDismissals(orgId)]);
  const signals = deriveSignals(observed.observations);

  const register: RegisterRisk[] = rows.map((r) => {
    const t = tracking?.get(r.id);
    return { id: r.id, title: r.title, status: r.status, controls: r.controls ?? [], libraryKey: t?.libraryKey ?? null, signalKeys: t?.signalKeys ?? [] };
  });

  const entries: RegisterEntry[] = rows.map((r, i) => {
    const t = tracking?.get(r.id);
    const live = liveStatus(register[i], observed.controls, signals, title);
    const cur = current(r, live.failingControls.length + live.signals.length);
    const inh = inherent(r);
    const tgt = target(r);
    return {
      ...r, ...(t ?? {}),
      inherent: inh, target: tgt, current: { likelihood: cur.likelihood, impact: cur.impact, score: cur.score, level: cur.level, raisedBy: cur.raisedBy, basis: cur.from.score },
      score: inh.score, level: inh.level, residualScore: tgt?.score ?? null,
      overdue: r.status !== 'closed' && !!r.reviewAt && new Date(r.reviewAt).getTime() < now.getTime(),
      acceptanceExpired: r.treatment === 'accept' && acceptanceExpired(t?.acceptUntil, now),
      live,
    };
  }).sort((a, b) => (a.status === 'closed' ? 1 : 0) - (b.status === 'closed' ? 1 : 0) || b.current.score - a.current.score || b.inherent.score - a.inherent.score);

  // Record moves in the computed current score as history.
  if (tracking) {
    const open = entries.filter((e) => e.status !== 'closed');
    const last = await lastCurrentScores(orgId, open.map((e) => e.id)).catch(() => null);
    if (last) {
      const moves = open.flatMap((e) => {
        const before = last.get(e.id) ?? e.current.basis;
        return before === e.current.score ? [] : [{ riskId: e.id, kind: 'signal' as const, detail: { from: before, to: e.current.score, why: e.live.sentence } }];
      });
      // AIC's own observation, so no person is named as its actor.
      await recordEvents(orgId, null, moves).catch(() => false);
    }
  }

  const grid = (pick: (e: RegisterEntry) => { likelihood: number; impact: number }) =>
    heatmap(entries.map((e) => ({ ...pick(e), status: e.status })));

  return {
    risks: entries,
    suggestions: suggestions(signals, register, dismissals ?? []),
    signals,
    dismissed: dismissals?.length ?? 0,
    live: tracking !== null,
    heatmap: { inherent: grid((e) => e.inherent), current: grid((e) => e.current) },
  };
}
