/**
 * Says versus does.
 *
 * An organisation's published policies make specific promises ("every account
 * uses a second factor", "every override records who made it"). The connectors
 * and the decision log observe what actually happens. This module lines the two
 * up, claim by claim, so a contradiction is shown in plain words with the
 * policy version that made the promise and the evidence that contradicts it.
 *
 * It is rule-based on purpose: each claim names the checks and platform facts
 * that bear on it, so every result can be traced and repeated. Nothing here is
 * a verdict on compliance; it tells the organisation (and later an assessor)
 * where its own words and its own systems disagree.
 *
 * Pure: no database or network. Tested in __tests__/lib/says-vs-does.test.ts.
 */

import { CHECK_BY_KEY } from './integrations/catalog';
import type { CheckStatus } from './integrations/catalog';

export type FactKey =
  | 'accountable_person_named'
  | 'production_systems_logging'
  | 'overrides_recorded'
  | 'ai_systems_declared';

export interface Claim {
  id: string;
  policyKey: string;
  /** The promise, quoted or closely paraphrased from the template section. */
  says: string;
  section: string;
  checks: string[];
  facts: FactKey[];
}

export const CLAIMS: Claim[] = [
  // Information security
  { id: 'infosec.second_factor', policyKey: 'information-security', section: 'Sign-in',
    says: 'Every account uses a second factor wherever the system supports it.',
    checks: ['m365.mfa_enforced', 'm365.mfa_registered', 'github.org_2fa_required'], facts: [] },
  { id: 'infosec.leavers', policyKey: 'information-security', section: 'Access',
    says: 'Access is removed on the day someone leaves.',
    checks: ['m365.stale_accounts'], facts: [] },
  { id: 'infosec.few_admins', policyKey: 'information-security', section: 'Access',
    says: 'Administrator rights are held by as few people as possible.',
    checks: ['m365.global_admins'], facts: [] },
  { id: 'infosec.code_review', policyKey: 'information-security', section: 'Software and code',
    says: 'Changes to production systems go through review by someone other than their author.',
    checks: ['github.branch_protected', 'github.review_required', 'github.merged_with_review'], facts: [] },
  { id: 'infosec.vulnerabilities', policyKey: 'information-security', section: 'Software and code',
    says: 'Known critical vulnerabilities are fixed promptly.',
    checks: ['github.no_critical_vulnerabilities'], facts: [] },
  { id: 'infosec.no_secrets', policyKey: 'information-security', section: 'Software and code',
    says: 'Credentials never go into code repositories, and a leaked credential is rotated immediately.',
    checks: ['github.no_exposed_secrets'], facts: [] },

  // AI acceptable use
  { id: 'aiuse.ai_code_reviewed', policyKey: 'ai-acceptable-use', section: 'Code written with AI',
    says: 'AI-written code is reviewed and approved by a person other than the one who prompted it before it is merged.',
    checks: ['github.ai_changes_reviewed'], facts: [] },
  { id: 'aiuse.agents_via_prs', policyKey: 'ai-acceptable-use', section: 'Code written with AI',
    says: 'AI agents work through pull requests and do not push directly to protected branches.',
    checks: ['github.branch_protected'], facts: [] },
  { id: 'aiuse.declared', policyKey: 'ai-acceptable-use', section: 'Approved tools',
    says: 'AI used with work information is approved and recorded in the AI inventory.',
    checks: ['ai.models_declared', 'github.ai_usage_declared'], facts: ['ai_systems_declared'] },

  // Human oversight
  { id: 'oversight.inventory', policyKey: 'human-oversight', section: 'Accountability',
    says: 'Every AI system that makes or informs a decision about a person is recorded in our AI inventory.',
    checks: ['ai.models_declared', 'github.ai_usage_declared'], facts: ['ai_systems_declared'] },
  { id: 'oversight.named_person', policyKey: 'human-oversight', section: 'Accountability',
    says: 'Each AI system has a named accountable person who has signed the declaration.',
    checks: [], facts: ['accountable_person_named'] },
  { id: 'oversight.overrides_logged', policyKey: 'human-oversight', section: 'Review and override',
    says: 'Every override records who made it and why.',
    checks: [], facts: ['production_systems_logging'] },
  { id: 'oversight.override_rate', policyKey: 'human-oversight', section: 'Review and override',
    says: 'Override rates are reviewed, and a rate near zero is investigated.',
    checks: [], facts: ['overrides_recorded'] },

  // Incident response
  { id: 'incident.rotate', policyKey: 'incident-response', section: 'Respond',
    says: 'A leaked password or key is revoked or rotated as a first step.',
    checks: ['github.no_exposed_secrets'], facts: [] },
];

export interface ObservedCheck { checkKey: string; subject: string; status: CheckStatus; summary: string }
export interface FactResult { ok: boolean | null; detail: string }
export type Facts = Partial<Record<FactKey, FactResult>>;

export interface PublishedPolicy {
  id: string;
  templateKey: string | null;
  title: string;
  publishedVersion: number;
  accepted: number;
  members: number;
}

export type Verdict = 'contradicted' | 'partly' | 'consistent' | 'not_observed';

export interface ClaimResult {
  claimId: string;
  policyId: string;
  policyTitle: string;
  version: number;
  section: string;
  says: string;
  verdict: Verdict;
  /** What the systems show, one line per contradicting or supporting source. */
  does: { source: string; status: 'fail' | 'warn' | 'pass' | 'unknown'; text: string }[];
  acceptedBy: string;
}

const RANK: Record<Verdict, number> = { contradicted: 0, partly: 1, not_observed: 2, consistent: 3 };

export function evaluateClaims(policies: PublishedPolicy[], checks: ObservedCheck[], facts: Facts): ClaimResult[] {
  const out: ClaimResult[] = [];
  for (const p of policies) {
    if (!p.templateKey || p.publishedVersion < 1) continue;
    for (const c of CLAIMS.filter((x) => x.policyKey === p.templateKey)) {
      const does: ClaimResult['does'] = [];
      for (const key of c.checks) {
        const rows = checks.filter((r) => r.checkKey === key);
        if (rows.length === 0) continue;
        const title = CHECK_BY_KEY[key]?.title ?? key;
        const failing = rows.filter((r) => r.status === 'fail');
        const warning = rows.filter((r) => r.status === 'warn');
        const passing = rows.filter((r) => r.status === 'pass');
        if (failing.length) {
          does.push({ source: title, status: 'fail', text: failing.length === 1 ? `${failing[0].subject}: ${failing[0].summary}` : `Failing for ${failing.length} of ${rows.length}: ${failing.slice(0, 3).map((r) => r.subject).join(', ')}${failing.length > 3 ? '…' : ''}` });
        } else if (warning.length) {
          does.push({ source: title, status: 'warn', text: `${warning[0].subject}: ${warning[0].summary}` });
        } else if (passing.length) {
          does.push({ source: title, status: 'pass', text: passing.length === 1 ? `${passing[0].subject}: ${passing[0].summary}` : `Passing for all ${passing.length}` });
        } else {
          does.push({ source: title, status: 'unknown', text: 'AIC could not check this.' });
        }
      }
      for (const f of c.facts) {
        const r = facts[f];
        if (!r) continue;
        does.push({ source: 'AIC record', status: r.ok === null ? 'unknown' : r.ok ? 'pass' : 'fail', text: r.detail });
      }
      const fails = does.filter((d) => d.status === 'fail').length;
      const passes = does.filter((d) => d.status === 'pass').length;
      const warns = does.filter((d) => d.status === 'warn').length;
      const verdict: Verdict =
        fails > 0 ? (passes > 0 ? 'partly' : 'contradicted')
        : warns > 0 ? 'partly'
        : passes > 0 ? 'consistent'
        : 'not_observed';
      out.push({
        claimId: c.id, policyId: p.id, policyTitle: p.title, version: p.publishedVersion,
        section: c.section, says: c.says, verdict, does,
        acceptedBy: `${p.accepted} of ${p.members}`,
      });
    }
  }
  return out.sort((a, b) => RANK[a.verdict] - RANK[b.verdict] || a.policyTitle.localeCompare(b.policyTitle));
}

export function summarise(results: ClaimResult[]) {
  return {
    total: results.length,
    contradicted: results.filter((r) => r.verdict === 'contradicted').length,
    partly: results.filter((r) => r.verdict === 'partly').length,
    consistent: results.filter((r) => r.verdict === 'consistent').length,
    notObserved: results.filter((r) => r.verdict === 'not_observed').length,
  };
}
