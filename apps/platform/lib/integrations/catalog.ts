/**
 * Every automated check AIC runs against a connected system, in one place.
 *
 * Each entry says what is checked, why it matters in the client's own terms,
 * how to fix a failure, and which published controls it is evidence for. The
 * control references are deliberately limited to ones that exist verbatim:
 * ISO/IEC 27001:2022 Annex A controls, POPIA sections, and AIC's own published
 * requirement codes. A check is evidence towards a control, never proof that
 * the control is met — that is still an assessor's call.
 */

export type CheckStatus = 'pass' | 'fail' | 'warn' | 'unknown';

import { CONNECTOR_CHECKS } from '../connectors/catalog';

export type CheckSource = 'github' | 'ai_provider' | 'microsoft' | 'connector';

export interface CheckDefinition {
  key: string;
  source: CheckSource;
  title: string;
  /** One sentence, from the client's side: why anyone should care. */
  why: string;
  /** What to do when it fails. Plain steps, no jargon. */
  fix: string;
  controls: string[];
  /** For connector checks: which connector runs it (lib/connectors/catalog). */
  connector?: string;
}

export const CHECKS: CheckDefinition[] = [
  // ── GitHub: who can change production code, and how ───────────────────────
  {
    key: 'github.branch_protected',
    source: 'github',
    title: 'Main branch is protected',
    why: 'Without protection anyone with write access can push straight to the branch your systems are built from, including an AI agent with a token.',
    fix: 'In the repository, open Settings → Rules (or Branches) and add a rule for the default branch that blocks direct pushes and force pushes.',
    controls: ['ISO 27001 A.8.4', 'ISO 27001 A.8.32', 'POPIA s19'],
  },
  {
    key: 'github.review_required',
    source: 'github',
    title: 'Changes need an approving review',
    why: 'A required review is the point where a named person accepts a change before it reaches production.',
    fix: 'In the branch rule for the default branch, require a pull request before merging with at least one approval.',
    controls: ['ISO 27001 A.8.32', 'ISO 27001 A.8.25', 'AIC HU-2'],
  },
  {
    key: 'github.merged_with_review',
    source: 'github',
    title: 'Recent changes were reviewed by someone else',
    why: 'Shows the review rule is actually followed: every pull request merged in the last 30 days had an approval from a person other than its author.',
    fix: 'Look at the pull requests listed, and either have them reviewed after the fact (record who and why) or tighten the branch rule so this cannot recur.',
    controls: ['ISO 27001 A.8.32', 'AIC HU-2'],
  },
  {
    key: 'github.ai_changes_reviewed',
    source: 'github',
    title: 'AI-written changes were reviewed by a person',
    why: 'Code written by an AI agent or assistant reached your default branch. Accountability needs a named human to have approved it, not only the agent that wrote it.',
    fix: 'Require human approval on the default branch, and make sure AI agents open pull requests rather than pushing directly.',
    controls: ['AIC HU-1', 'AIC HU-2', 'ISO 27001 A.8.32'],
  },
  {
    key: 'github.no_critical_vulnerabilities',
    source: 'github',
    title: 'No open critical or high vulnerability alerts',
    why: 'Known-vulnerable dependencies are the most common way in. Dependabot already knows about these.',
    fix: 'Open the repository’s Security tab → Dependabot alerts, and update or replace the listed packages.',
    controls: ['ISO 27001 A.8.8', 'POPIA s19'],
  },
  {
    key: 'github.no_exposed_secrets',
    source: 'github',
    title: 'No open leaked-secret alerts',
    why: 'A key committed to a repository should be treated as public. Secret scanning has found ones that are still open.',
    fix: 'Rotate each listed credential with its provider first, then close the alert. Removing it from the code is not enough.',
    controls: ['ISO 27001 A.5.17', 'ISO 27001 A.8.4', 'POPIA s19'],
  },
  {
    key: 'github.ai_usage_declared',
    source: 'github',
    title: 'AI libraries in code match the declared inventory',
    why: 'This repository depends on an AI SDK (OpenAI, Anthropic and others). If it makes decisions about people, it belongs in your AI inventory with an accountable person.',
    fix: 'Declare the system on the AI Estate page, or mark the repository as not making automated decisions.',
    controls: ['AIC HU-1', 'POPIA s71'],
  },
  {
    key: 'github.org_2fa_required',
    source: 'github',
    title: 'Two-factor sign-in is required for the GitHub organisation',
    why: 'A stolen password should not be enough to change your code.',
    fix: 'In GitHub, open the organisation’s Settings → Authentication security and require two-factor authentication.',
    controls: ['ISO 27001 A.8.5', 'POPIA s19'],
  },

  // ── AI providers: what is actually being used ─────────────────────────────
  {
    key: 'ai.usage_fresh',
    source: 'ai_provider',
    title: 'Usage is reaching AIC',
    why: 'Every other AI check depends on current usage figures. If none have arrived for three days, the exporter or key has stopped working.',
    fix: 'If you use the exporter, check that its scheduled job is still running. If AIC pulls with a key, check the key has not been revoked.',
    controls: ['AIC continuity record'],
  },
  {
    key: 'ai.models_declared',
    source: 'ai_provider',
    title: 'Models in use are covered by a declared system',
    why: 'Usage shows models being called. Each should belong to a declared AI system, so someone is accountable for what it does.',
    fix: 'Link each listed model to the declared system that uses it (or mark it as not used for decisions), or have the exporter name the system on each usage line.',
    controls: ['AIC HU-1', 'POPIA s71'],
  },

  {
    key: 'ai.tool_on_register',
    source: 'ai_provider',
    title: 'AI tools in use are on your AI register',
    why: 'People in your organisation are using this AI product. Your AI register should name it and the person accountable for how it is used, even if it makes no decisions about people.',
    fix: 'Declare it on the AI Estate page under a name that includes the product (for example "Microsoft 365 Copilot"), with an owner and what it is used for.',
    controls: ['AIC HU-3', 'AIC HU-1'],
  },

  // ── Microsoft 365: who can sign in, and how ───────────────────────────────
  {
    key: 'm365.mfa_enforced',
    source: 'microsoft',
    title: 'A second factor is required at sign-in',
    why: 'A password alone is the most common way into a company. Microsoft 365 can require a second factor of everyone; this checks that it does.',
    fix: 'In Entra ID, turn on security defaults, or create a Conditional Access policy that requires multifactor authentication for all users.',
    controls: ['ISO 27001 A.8.5', 'POPIA s19'],
  },
  {
    key: 'm365.mfa_registered',
    source: 'microsoft',
    title: 'Everyone has a second factor registered',
    why: 'A requirement nobody has registered for is not protection yet. People without a registered method are the gap.',
    fix: 'Ask each listed person to register the Microsoft Authenticator app at aka.ms/mysecurityinfo. Start with administrators.',
    controls: ['ISO 27001 A.8.5', 'ISO 27001 A.5.17'],
  },
  {
    key: 'm365.global_admins',
    source: 'microsoft',
    title: 'Global administrators are few, but more than one',
    why: 'Every global administrator can change anything in the tenant. Too many widens the target; only one means losing that account locks everyone out.',
    fix: 'Keep two to four global administrators. Give everyone else a narrower admin role for the job they do.',
    controls: ['ISO 27001 A.8.2', 'ISO 27001 A.5.15'],
  },
  {
    key: 'm365.stale_accounts',
    source: 'microsoft',
    title: 'Unused accounts are switched off',
    why: 'Accounts of people who have left, or never used them, still open doors. Nobody notices when one is misused.',
    fix: 'Disable each listed account if the person has left or no longer needs it, and add account removal to your leaver process.',
    controls: ['ISO 27001 A.5.18', 'POPIA s19'],
  },
];

// Every connector's checks (AWS, Okta, Jamf and the rest), in the same shape.
CHECKS.push(...CONNECTOR_CHECKS.map(({ key, title, why, fix, controls, connector }) => ({ key, source: 'connector' as const, title, why, fix, controls, connector })));

export const CHECK_BY_KEY: Record<string, CheckDefinition> = Object.fromEntries(CHECKS.map((c) => [c.key, c]));

export interface CheckResult {
  checkKey: string;
  subject: string;
  status: CheckStatus;
  summary: string;
  detail?: Record<string, unknown>;
}
