import type { CheckResult } from './catalog';
import { PROVIDER_LABEL, type Provider } from './providers';

/**
 * The judgements behind the AI provider checks. Pure, so they can be tested
 * without a database.
 */

export const FRESH_DAYS = 3;
const DAY = 86_400_000;

export type UsageSummaryRow = {
  model: string | null;
  systemName: string | null;
  periodEnd: Date;
  tokens: number;
};

export function evaluateProvider(input: {
  provider: Provider;
  connectedAt: Date;
  rows: UsageSummaryRow[];
  declaredSystemNames: Set<string>;
  declaredSystemIds: Set<string>;
  /** model → declared system id, or 'none' for "not used for decisions". */
  links: Record<string, string>;
  now?: number;
}): CheckResult[] {
  const { provider, rows, connectedAt, declaredSystemNames, declaredSystemIds, links } = input;
  const now = input.now ?? Date.now();
  const label = PROVIDER_LABEL[provider];
  const out: CheckResult[] = [];

  const latest = rows.reduce<Date | null>((m, r) => (!m || r.periodEnd > m ? r.periodEnd : m), null);
  if (!latest) {
    const young = now - connectedAt.getTime() < 2 * DAY;
    out.push({
      checkKey: 'ai.usage_fresh', subject: provider, status: young ? 'warn' : 'fail',
      summary: young ? `Waiting for the first ${label} usage to arrive.` : `No ${label} usage has ever reached AIC.`,
    });
  } else {
    const ageDays = Math.floor((now - latest.getTime()) / DAY);
    out.push({
      checkKey: 'ai.usage_fresh', subject: provider, status: ageDays <= FRESH_DAYS ? 'pass' : 'fail',
      summary: ageDays <= FRESH_DAYS
        ? `${label} usage is current (latest day ending ${latest.toISOString().slice(0, 10)}).`
        : `The latest ${label} usage is ${ageDays} days old.`,
      detail: { latest: latest.toISOString() },
    });
  }

  // Models used in the last 30 days, and whether each is accounted for.
  const recent = rows.filter((r) => now - r.periodEnd.getTime() <= 30 * DAY && r.tokens > 0);
  const byModel = new Map<string, { tokens: number; attributed: boolean }>();
  for (const r of recent) {
    const model = r.model ?? '(unattributed)';
    const e = byModel.get(model) ?? { tokens: 0, attributed: false };
    e.tokens += r.tokens;
    if (r.systemName && declaredSystemNames.has(r.systemName.trim().toLowerCase())) e.attributed = true;
    byModel.set(model, e);
  }
  if (byModel.size > 0) {
    const uncovered: { model: string; tokens: number }[] = [];
    for (const [model, e] of byModel) {
      const link = links[model];
      const linked = link === 'none' || (!!link && declaredSystemIds.has(link));
      if (!e.attributed && !linked) uncovered.push({ model, tokens: e.tokens });
    }
    uncovered.sort((a, b) => b.tokens - a.tokens);
    out.push(
      uncovered.length === 0
        ? {
            checkKey: 'ai.models_declared', subject: provider, status: 'pass',
            summary: byModel.size === 1
              ? `The one ${label} model used in the last 30 days belongs to a declared system.`
              : `All ${byModel.size} ${label} models used in the last 30 days belong to a declared system.`,
          }
        : {
            checkKey: 'ai.models_declared', subject: provider, status: 'fail',
            summary: `${uncovered.length} ${label} model${uncovered.length === 1 ? ' is' : 's are'} in use without a declared system: ${uncovered
              .slice(0, 4)
              .map((u) => u.model)
              .join(', ')}${uncovered.length > 4 ? '…' : ''}.`,
            detail: { models: uncovered },
          }
    );
  }

  return out;
}
