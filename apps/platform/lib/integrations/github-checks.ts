import type { CheckResult } from './catalog';
import type { RepoFacts, PullRequest, Review } from './github';

/**
 * The judgements behind the GitHub checks. Pure, so each one can be argued
 * with and tested without GitHub.
 */

/** Packages that mean a repository calls a model or trains one. */
export const AI_PACKAGES: { pattern: RegExp; label: string }[] = [
  { pattern: /^npm:openai$|^(pypi|pip):openai$/, label: 'OpenAI SDK' },
  { pattern: /^npm:@anthropic-ai\/|^(pypi|pip):anthropic$/, label: 'Anthropic SDK' },
  { pattern: /^npm:@google\/(generative-ai|genai)$|^(pypi|pip):google-(generativeai|genai)$/, label: 'Google Gemini SDK' },
  { pattern: /^npm:@mistralai\/|^(pypi|pip):mistralai$/, label: 'Mistral SDK' },
  { pattern: /^npm:cohere-ai$|^(pypi|pip):cohere$/, label: 'Cohere SDK' },
  { pattern: /^npm:(@azure\/openai|@aws-sdk\/client-bedrock-runtime)$|^(pypi|pip):boto3-bedrock$/, label: 'Cloud model service SDK' },
  { pattern: /^npm:(ai|@ai-sdk\/.+)$/, label: 'Vercel AI SDK' },
  { pattern: /^npm:(langchain|@langchain\/.+)$|^(pypi|pip):langchain(-.+)?$/, label: 'LangChain' },
  { pattern: /^npm:llamaindex$|^(pypi|pip):llama-index(-.+)?$/, label: 'LlamaIndex' },
  { pattern: /^(pypi|pip):(transformers|torch|tensorflow|keras)$/, label: 'Deep learning library' },
  { pattern: /^(pypi|pip):(scikit-learn|xgboost|lightgbm|catboost)$/, label: 'Machine learning library' },
];

export function aiLibraries(packages: string[]): string[] {
  const found = new Set<string>();
  for (const p of packages) for (const a of AI_PACKAGES) if (a.pattern.test(p)) found.add(a.label);
  return [...found].sort();
}

const AI_AUTHOR = /(copilot|devin|claude|codex|cursor|sweep|openhands|jules|aider|codegen|tabnine|amazon-q|gemini)/i;
const AI_TRAILER =
  /(generated with \[?claude code|co-authored-by:[^\n]*(claude|copilot|cursor|codex|devin|gemini|anthropic|openai)|🤖 generated with|created by (devin|codex|copilot))/i;

/** Was this pull request written by an AI agent or assistant, as far as GitHub shows? */
export function isAiAuthored(pr: PullRequest): boolean {
  const login = pr.user?.login ?? '';
  if (pr.user?.type === 'Bot' && AI_AUTHOR.test(login)) return true;
  if (AI_AUTHOR.test(login) && login.endsWith('[bot]')) return true;
  return AI_TRAILER.test(`${pr.title}\n${pr.body ?? ''}`);
}

/** An approval from a person who is not the author and not a bot. */
export function hasIndependentHumanApproval(pr: PullRequest & { reviews: Review[] }): boolean {
  const author = pr.user?.login?.toLowerCase();
  return pr.reviews.some(
    (r) => r.state === 'APPROVED' && r.user && r.user.type !== 'Bot' && r.user.login.toLowerCase() !== author
  );
}

function approvalsRequired(f: RepoFacts): number | null {
  const fromProtection = f.protection?.required_pull_request_reviews?.required_approving_review_count;
  const fromRules = (f.rules ?? [])
    .filter((r) => r.type === 'pull_request')
    .map((r) => r.parameters?.required_approving_review_count ?? 0);
  const best = Math.max(fromProtection ?? -1, ...fromRules, -1);
  if (best >= 0) return best;
  if (f.protectionStatus === 'unknown' && f.rules === null) return null;
  return 0;
}

export type RepoLink = string | 'none' | undefined;

export function evaluateRepo(
  f: RepoFacts,
  opts: { link?: RepoLink; declaredSystemIds?: Set<string> } = {}
): CheckResult[] {
  const subject = f.repo.full_name;
  const branch = f.repo.default_branch;
  const out: CheckResult[] = [];

  // Protected: classic branch protection, or a ruleset that blocks direct
  // pushes (a pull_request rule) or force pushes (non_fast_forward).
  const rulesetProtects = (f.rules ?? []).some((r) => r.type === 'pull_request' || r.type === 'non_fast_forward');
  if (f.protectionStatus === 'protected' || rulesetProtects) {
    out.push({ checkKey: 'github.branch_protected', subject, status: 'pass', summary: `${branch} is protected.` });
  } else if (f.protectionStatus === 'unknown' && f.rules === null) {
    out.push({
      checkKey: 'github.branch_protected', subject, status: 'unknown',
      summary: 'AIC was not given permission to read branch rules for this repository.',
    });
  } else {
    out.push({
      checkKey: 'github.branch_protected', subject, status: 'fail',
      summary: `${branch} has no protection: anyone with write access can push to it directly.`,
    });
  }

  const required = approvalsRequired(f);
  if (required === null) {
    out.push({ checkKey: 'github.review_required', subject, status: 'unknown', summary: 'AIC could not read the review rule.' });
  } else if (required >= 1) {
    out.push({
      checkKey: 'github.review_required', subject, status: 'pass',
      summary: `${required} approving review${required === 1 ? '' : 's'} required before merging to ${branch}.`,
    });
  } else {
    out.push({
      checkKey: 'github.review_required', subject, status: 'fail',
      summary: `Changes can merge to ${branch} without anyone approving them.`,
    });
  }

  if (f.mergedPulls === null) {
    out.push({ checkKey: 'github.merged_with_review', subject, status: 'unknown', summary: 'AIC could not read pull requests.' });
    out.push({ checkKey: 'github.ai_changes_reviewed', subject, status: 'unknown', summary: 'AIC could not read pull requests.' });
  } else {
    const unreviewed = f.mergedPulls.filter((p) => !hasIndependentHumanApproval(p));
    const list = (ps: typeof unreviewed) => ps.map((p) => ({ number: p.number, title: p.title, url: p.html_url, author: p.user?.login ?? null }));
    if (f.mergedPulls.length === 0) {
      out.push({ checkKey: 'github.merged_with_review', subject, status: 'pass', summary: 'No pull requests merged in the last 30 days.' });
    } else if (unreviewed.length === 0) {
      out.push({
        checkKey: 'github.merged_with_review', subject, status: 'pass',
        summary: `All ${f.mergedPulls.length} pull requests merged in the last 30 days were approved by someone other than the author.`,
      });
    } else {
      out.push({
        checkKey: 'github.merged_with_review', subject, status: 'fail',
        summary: `${unreviewed.length} of ${f.mergedPulls.length} merged pull requests had no approval from another person.`,
        detail: { pulls: list(unreviewed) },
      });
    }

    const ai = f.mergedPulls.filter(isAiAuthored);
    const aiUnreviewed = ai.filter((p) => !hasIndependentHumanApproval(p));
    if (ai.length === 0) {
      out.push({ checkKey: 'github.ai_changes_reviewed', subject, status: 'pass', summary: 'No AI-written pull requests merged in the last 30 days.' });
    } else if (aiUnreviewed.length === 0) {
      out.push({
        checkKey: 'github.ai_changes_reviewed', subject, status: 'pass',
        summary: `${ai.length} AI-written pull request${ai.length === 1 ? ' was' : 's were'} merged, each approved by a person.`,
        detail: { pulls: list(ai) },
      });
    } else {
      out.push({
        checkKey: 'github.ai_changes_reviewed', subject, status: 'fail',
        summary: `${aiUnreviewed.length} AI-written pull request${aiUnreviewed.length === 1 ? '' : 's'} merged without a person approving.`,
        detail: { pulls: list(aiUnreviewed) },
      });
    }
  }

  if (f.openSevereVulnerabilities === null) {
    out.push({
      checkKey: 'github.no_critical_vulnerabilities', subject, status: 'unknown',
      summary: 'Dependabot alerts are off for this repository, or AIC was not given permission to read them.',
    });
  } else {
    out.push({
      checkKey: 'github.no_critical_vulnerabilities', subject,
      status: f.openSevereVulnerabilities === 0 ? 'pass' : 'fail',
      summary: f.openSevereVulnerabilities === 0
        ? 'No open critical or high Dependabot alerts.'
        : `${f.openSevereVulnerabilities} open critical or high Dependabot alert${f.openSevereVulnerabilities === 1 ? '' : 's'}.`,
    });
  }

  if (f.openSecretAlerts === null) {
    out.push({
      checkKey: 'github.no_exposed_secrets', subject, status: 'unknown',
      summary: 'Secret scanning is off for this repository, or AIC was not given permission to read it.',
    });
  } else {
    out.push({
      checkKey: 'github.no_exposed_secrets', subject,
      status: f.openSecretAlerts === 0 ? 'pass' : 'fail',
      summary: f.openSecretAlerts === 0
        ? 'No open leaked-secret alerts.'
        : `${f.openSecretAlerts} leaked secret${f.openSecretAlerts === 1 ? ' is' : 's are'} still open.`,
    });
  }

  if (f.packages !== null) {
    const libs = aiLibraries(f.packages);
    if (libs.length > 0) {
      const link = opts.link;
      const linkedToLiveSystem = !!link && link !== 'none' && (opts.declaredSystemIds?.has(link) ?? false);
      if (link === 'none') {
        out.push({
          checkKey: 'github.ai_usage_declared', subject, status: 'pass',
          summary: `Uses ${libs.join(', ')}; marked as not making automated decisions.`,
          detail: { libraries: libs, link: 'none' },
        });
      } else if (linkedToLiveSystem) {
        out.push({
          checkKey: 'github.ai_usage_declared', subject, status: 'pass',
          summary: `Uses ${libs.join(', ')}; linked to a declared AI system.`,
          detail: { libraries: libs, link },
        });
      } else {
        out.push({
          checkKey: 'github.ai_usage_declared', subject, status: 'fail',
          summary: `Uses ${libs.join(', ')}, but is not linked to any declared AI system.`,
          detail: { libraries: libs },
        });
      }
    }
  }

  return out;
}

export function evaluateOrg2fa(login: string, required: boolean | null): CheckResult {
  if (required === null) {
    return {
      checkKey: 'github.org_2fa_required', subject: login, status: 'unknown',
      summary: 'AIC was not given permission to read the organisation’s security settings.',
    };
  }
  return {
    checkKey: 'github.org_2fa_required', subject: login, status: required ? 'pass' : 'fail',
    summary: required ? 'Two-factor sign-in is required for every member.' : 'Members can sign in to GitHub with a password alone.',
  };
}
