/**
 * Signals that keep the risk register live.
 *
 * AIC already watches an organisation's estate: automated checks on its
 * connected systems, the AI systems that log decisions or usage, its
 * suppliers, its leavers, its findings and access reviews, its AI spend and
 * the models it pays for. Each observation that points at a risk is a
 * signal. A signal either evidences a risk already on the register, or, when
 * nothing on the register covers it, becomes a suggestion: "AIC noticed".
 *
 * Pure functions over plain data (lib/registers/risk-observe gathers it), so
 * they can be tested without a database. Nothing here changes a risk a person
 * recorded: the page shows what the evidence says next to it.
 *
 * Tested in __tests__/lib/risk-signals.test.ts.
 */
import { LIBRARY_BY_KEY, RISK_LIBRARY } from './risk-library';

export type SignalKind =
  | 'check' | 'undeclared_ai' | 'supplier' | 'leavers' | 'findings'
  | 'access_review' | 'model_retiring' | 'spend' | 'quiet_system';

export type Signal = {
  /** Stable identity: `${kind}:${subject}`. Stored on a risk it was added from, and on a dismissal. */
  id: string;
  kind: SignalKind;
  subject: string;
  /** One line: what AIC noticed. */
  title: string;
  /** What the record says, in a sentence or two. Every figure comes from the record. */
  evidence: string;
  href: string;
  /** Library templates this evidences, most fitting first. */
  libraryKeys: string[];
  /** Common controls the signal is about; a risk listing one of these covers a failing check. */
  controls: string[];
};

/** What AIC observed for one organisation, gathered by lib/registers/risk-observe. */
export type RiskObservations = {
  failingChecks: { checkKey: string; title: string; subject: string; summary: string; controls: string[] }[];
  undeclared: { name: string; decisions?: number; provider?: string }[];
  suppliers: { name: string; flags: string[] }[];
  leavers: { status: string; label: string } | null;
  overdueFindings: { title: string; dueAt: string }[];
  accessReview: { status: string; label: string } | null;
  overdueAccessReviews: { name: string; dueAt: string }[];
  retiringModels: { model: string; provider: string; status: 'deprecated' | 'retired'; on: string | null; daysLeft: number | null }[];
  spend: { monthToDate: number; projected: number | null; budget: number } | null;
  quietSystems: { name: string; decisions: number; days: number }[];
};

export const emptyObservations = (): RiskObservations => ({
  failingChecks: [], undeclared: [], suppliers: [], leavers: null, overdueFindings: [], accessReview: null,
  overdueAccessReviews: [], retiringModels: [], spend: null, quietSystems: [],
});

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const usd = (n: number) => `$${n.toFixed(2)}`;
const list = (xs: string[], n = 3) => xs.length <= n ? xs.join(', ') : `${xs.slice(0, n).join(', ')} and ${xs.length - n} more`;

/** Library templates a failing check on these controls should raise. */
export function templatesForControls(controls: string[]): string[] {
  const rank = (t: (typeof RISK_LIBRARY)[number]) => Math.min(...(t.raisedBy ?? []).map((c) => controls.indexOf(c)).filter((i) => i >= 0));
  // Ordered by the check's own controls, so its main control picks the template first.
  return RISK_LIBRARY.filter((t) => t.signals.includes('check') && (t.raisedBy ?? []).some((c) => controls.includes(c)))
    .sort((a, b) => rank(a) - rank(b)).map((t) => t.key);
}

/** Supplier flags (lib/registers/suppliers supplierFlags and documentConcerns) to the risks they evidence. */
function supplierTemplates(flag: string): string[] {
  if (/s72/.test(flag)) return ['pi_cross_border'];
  if (/s21/.test(flag)) return ['supplier_no_agreement', 'pi_cross_border'];
  return ['supplier_breach'];
}

/** Turns observations into signals. */
export function deriveSignals(o: RiskObservations): Signal[] {
  const out: Signal[] = [];

  // Failing automated checks, one signal per check, across its subjects.
  const byCheck = new Map<string, RiskObservations['failingChecks']>();
  for (const c of o.failingChecks) byCheck.set(c.checkKey, [...(byCheck.get(c.checkKey) ?? []), c]);
  for (const [key, rows] of byCheck) {
    const libraryKeys = templatesForControls(rows[0].controls);
    out.push({
      id: `check:${key}`, kind: 'check', subject: key,
      title: `Failing check: ${rows[0].title}`,
      evidence: rows.map((r) => r.summary).join(' '),
      href: '/checks', libraryKeys, controls: rows[0].controls,
    });
  }

  if (o.undeclared.length) {
    const names = o.undeclared.map((u) => u.name);
    out.push({
      id: 'undeclared_ai:systems', kind: 'undeclared_ai', subject: 'systems',
      title: `${plural(o.undeclared.length, 'AI system')} in use but not declared`,
      evidence: o.undeclared.map((u) => u.decisions !== undefined ? `${u.name} logged ${plural(u.decisions, 'decision')}` : `${u.name} appears in ${u.provider ?? 'AI'} usage`).join('; ') + `, and ${names.length === 1 ? 'is' : 'are'} not in the AI system inventory.`,
      href: '/overview', libraryKeys: ['shadow_ai'], controls: ['ai.inventory'],
    });
  }

  for (const s of o.suppliers) {
    for (const flag of s.flags) {
      const libraryKeys = supplierTemplates(flag);
      const tag = /s72/.test(flag) ? 'abroad' : /s21/.test(flag) ? 'agreement' : /report/.test(flag) ? 'report' : 'rating';
      out.push({
        id: `supplier:${s.name}|${tag}`, kind: 'supplier', subject: `${s.name}|${tag}`,
        title: `Supplier ${s.name}: ${tag === 'abroad' ? 'personal information leaves South Africa unprotected' : tag === 'agreement' ? 'no data processing agreement' : tag === 'report' ? 'security report out of date' : 'criticality too low for the data it holds'}`,
        evidence: `${s.name}: ${flag}`,
        href: '/suppliers', libraryKeys, controls: ['ops.supplier_mgmt'],
      });
    }
  }

  if (o.leavers?.status === 'fail') {
    out.push({ id: 'leavers:access', kind: 'leavers', subject: 'access', title: 'Leavers still have access', evidence: `${o.leavers.label}.`, href: '/people', libraryKeys: ['leaver_access'], controls: ['iam.leavers'] });
  }

  if (o.overdueFindings.length) {
    out.push({
      id: 'findings:overdue', kind: 'findings', subject: 'overdue',
      title: `${plural(o.overdueFindings.length, 'audit finding')} past ${o.overdueFindings.length === 1 ? 'its' : 'their'} due date`,
      evidence: o.overdueFindings.map((f) => `"${f.title}" was due ${day(f.dueAt)}`).join('; ') + '.',
      href: '/findings', libraryKeys: ['findings_unresolved'], controls: ['gov.risk_assessment'],
    });
  }

  if (o.accessReview?.status === 'fail' || o.overdueAccessReviews.length) {
    const parts = [
      ...(o.accessReview?.status === 'fail' ? [o.accessReview.label] : []),
      ...o.overdueAccessReviews.map((r) => `${r.name} was due ${day(r.dueAt)} and is still open`),
    ];
    out.push({ id: 'access_review:overdue', kind: 'access_review', subject: 'overdue', title: 'Access reviews are overdue', evidence: parts.join('; ') + '.', href: '/access-reviews', libraryKeys: ['access_not_reviewed'], controls: ['iam.access_review'] });
  }

  for (const m of o.retiringModels) {
    const when = m.status === 'retired'
      ? `was retired${m.on ? ` on ${day(m.on)}` : ''}`
      : m.on ? `will be retired on ${day(m.on)}${m.daysLeft !== null && m.daysLeft >= 0 ? `, in ${plural(m.daysLeft, 'day')}` : ''}` : 'is deprecated';
    out.push({
      id: `model_retiring:${m.model}`, kind: 'model_retiring', subject: m.model,
      title: `${m.model} ${m.status === 'retired' ? 'has been retired' : 'is being retired'}`,
      evidence: `${m.model} is still in use and ${when}.`,
      href: '/spend', libraryKeys: ['model_deprecation'], controls: ['ai.documentation'],
    });
  }

  if (o.spend && o.spend.budget > 0) {
    const over = o.spend.monthToDate > o.spend.budget;
    const heading = !over && o.spend.projected !== null && o.spend.projected > o.spend.budget;
    if (over || heading) {
      out.push({
        id: 'spend:budget', kind: 'spend', subject: 'budget',
        title: over ? 'AI spend is over this month\'s budget' : 'AI spend is on course to pass this month\'s budget',
        evidence: over
          ? `${usd(o.spend.monthToDate)} spent so far this month against a budget of ${usd(o.spend.budget)}.`
          : `At the current rate the month ends near ${usd(o.spend.projected!)}, against a budget of ${usd(o.spend.budget)}.`,
        href: '/spend', libraryKeys: ['ai_spend_overrun'], controls: ['ai.monitoring'],
      });
    }
  }

  for (const q of o.quietSystems) {
    out.push({
      id: `quiet_system:${q.name}`, kind: 'quiet_system', subject: q.name,
      title: `No person has overridden ${q.name}`,
      evidence: `${q.name} is a high-risk system and logged ${plural(q.decisions, 'decision')} in the last ${q.days} days with no human override. Either nobody can override it, or nobody does.`,
      href: '/record', libraryKeys: ['no_human_override', 'ai_unfair_outcomes'], controls: ['ai.human_oversight'],
    });
  }

  return out;
}

export type RegisterRisk = {
  id: string; title: string; status: string; controls: string[];
  libraryKey: string | null; signalKeys: string[];
};

/** Whether a risk on the register already covers a signal. Closed risks cover nothing. */
export function covers(r: RegisterRisk, s: Signal): boolean {
  if (r.status === 'closed') return false;
  if (r.signalKeys.includes(s.id)) return true;
  if (r.libraryKey && s.libraryKeys.includes(r.libraryKey)) return true;
  // A failing check is covered by any risk that relies on the control it tests.
  if (s.kind === 'check' && r.controls.some((c) => s.controls.includes(c))) return true;
  return false;
}

export type Suggestion = {
  /** The library template to add; also the suggestion's identity on the page. */
  libraryKey: string;
  title: string;
  category: string;
  likelihood: number;
  impact: number;
  signals: Signal[];
};

export type Dismissal = { signalKey: string; subject: string };

/**
 * Signals nothing on the register covers, grouped by the template they
 * suggest. A dismissed signal stays dismissed; a new signal for the same
 * template raises the suggestion again, with only the new evidence.
 */
export function suggestions(signals: Signal[], register: RegisterRisk[], dismissed: Dismissal[]): Suggestion[] {
  const gone = new Set(dismissed.map((d) => `${d.signalKey}:${d.subject}`));
  const groups = new Map<string, Signal[]>();
  for (const s of signals) {
    if (gone.has(s.id) || register.some((r) => covers(r, s))) continue;
    const key = s.libraryKeys.find((k) => LIBRARY_BY_KEY[k]);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  return [...groups].map(([key, sigs]) => {
    const t = LIBRARY_BY_KEY[key];
    return { libraryKey: key, title: t.title, category: t.category, likelihood: t.likelihood, impact: t.impact, signals: sigs };
  }).sort((a, b) => b.likelihood * b.impact - a.likelihood * a.impact || a.title.localeCompare(b.title));
}

/** The description a risk added from a suggestion starts with: the template's, then what AIC saw. */
export function suggestedDescription(libraryKey: string, signals: Signal[], today: string): string {
  const t = LIBRARY_BY_KEY[libraryKey];
  const seen = signals.map((s) => `- ${s.evidence}`).join('\n');
  return `${t?.description ?? ''}\n\nAIC noticed on ${day(today)}:\n${seen}`.trim().slice(0, 4000);
}

/** Control status, as lib/controls evaluates it. */
export type ControlState = 'evidenced' | 'partial' | 'gap' | 'no_evidence' | 'not_mapped';

export type LiveStatus = {
  trend: 'worse' | 'supported' | 'unverified';
  failingControls: string[];
  supportingControls: string[];
  /** Signals evidencing the risk that are not already a failing control. */
  signals: Signal[];
  sentence: string;
};

/** What the evidence says about one risk on the register. */
export function liveStatus(r: RegisterRisk, controls: Record<string, ControlState>, signals: Signal[], controlTitle: (k: string) => string = (k) => k): LiveStatus {
  const failingControls = r.controls.filter((k) => controls[k] === 'gap');
  const supportingControls = r.controls.filter((k) => controls[k] === 'evidenced');
  const linked = r.status === 'closed' ? [] : signals.filter((s) => covers(r, s) && !(s.kind === 'check' && s.controls.some((c) => failingControls.includes(c))));
  if (r.status !== 'closed' && (failingControls.length || linked.length)) {
    const parts = [
      ...(failingControls.length ? [`${failingControls.length === 1 ? 'a control it relies on is' : `${failingControls.length} controls it relies on are`} failing: ${list(failingControls.map(controlTitle))}`] : []),
      ...(linked.length ? [`AIC noticed ${list(linked.map((s) => s.title.charAt(0).toLowerCase() + s.title.slice(1)), 2)}`] : []),
    ];
    return { trend: 'worse', failingControls, supportingControls, signals: linked, sentence: `Evidence says this is getting worse: ${parts.join('; ')}.` };
  }
  if (r.controls.length && supportingControls.length === r.controls.length) {
    return { trend: 'supported', failingControls, supportingControls, signals: [], sentence: `Evidence supports the treatment: ${r.controls.length === 1 ? 'its control is' : `all ${r.controls.length} controls are`} evidenced.` };
  }
  return { trend: 'unverified', failingControls, supportingControls, signals: [], sentence: r.controls.length ? 'AIC has no failing evidence for this risk, but not every control it relies on is evidenced yet.' : 'No controls are linked, so AIC cannot check this risk against evidence.' };
}
