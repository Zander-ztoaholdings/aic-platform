// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { generateKeyPairSync, createVerify } from 'crypto';
import { appJwt, packageNames, type RepoFacts, type PullRequest, type Review } from '@/lib/integrations/github';
import { evaluateRepo, evaluateOrg2fa, isAiAuthored, hasIndependentHumanApproval, aiLibraries } from '@/lib/integrations/github-checks';
import { mapOpenAI, mapAnthropic, modelFromLineItem, keyShapeProblem } from '@/lib/integrations/providers';
import { evaluateProvider } from '@/lib/integrations/provider-checks';
import { signState, verifyState } from '@/lib/integrations/state';
import { CHECKS, CHECK_BY_KEY } from '@/lib/integrations/catalog';
import { diffEstate, narrateEvent, type EstateState } from '@/lib/continuity';

const NOW = Date.parse('2026-10-04T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

const repo = { full_name: 'acme/lending-api', name: 'lending-api', default_branch: 'main', archived: false, private: true, owner: { login: 'acme', type: 'Organization' } };

function facts(over: Partial<RepoFacts> = {}): RepoFacts {
  return {
    repo, protection: null, protectionStatus: 'unprotected', rules: [], mergedPulls: [],
    openSevereVulnerabilities: 0, openSecretAlerts: 0, packages: [], ...over,
  };
}
const pr = (n: number, login: string, type = 'User', extra: Partial<PullRequest> = {}): PullRequest & { reviews: Review[] } => ({
  number: n, title: `PR ${n}`, body: null, html_url: `https://github.com/acme/lending-api/pull/${n}`,
  merged_at: daysAgo(2), user: { login, type }, reviews: [], ...extra,
});
const approve = (login: string, type = 'User'): Review => ({ state: 'APPROVED', user: { login, type } });
const byKey = (rs: { checkKey: string }[], k: string) => rs.find((r) => r.checkKey === k) as unknown as { status: string; summary: string; detail?: Record<string, unknown> };

describe('catalog', () => {
  it('has unique keys, and every check says why and how to fix', () => {
    expect(new Set(CHECKS.map((c) => c.key)).size).toBe(CHECKS.length);
    for (const c of CHECKS) {
      expect(c.why.length).toBeGreaterThan(20);
      expect(c.fix.length).toBeGreaterThan(20);
      expect(c.controls.length).toBeGreaterThan(0);
    }
  });
});

describe('GitHub checks', () => {
  it('fails an unprotected default branch that has no review rule', () => {
    const r = evaluateRepo(facts());
    expect(byKey(r, 'github.branch_protected').status).toBe('fail');
    expect(byKey(r, 'github.review_required').status).toBe('fail');
  });

  it('accepts a ruleset in place of classic branch protection', () => {
    const r = evaluateRepo(facts({ rules: [{ type: 'pull_request', parameters: { required_approving_review_count: 2 } }] }));
    expect(byKey(r, 'github.branch_protected').status).toBe('pass');
    expect(byKey(r, 'github.review_required').summary).toContain('2 approving reviews');
  });

  it('says "unknown", never "pass", when AIC was not allowed to look', () => {
    const r = evaluateRepo(facts({ protectionStatus: 'unknown', rules: null, mergedPulls: null, openSevereVulnerabilities: null, openSecretAlerts: null }));
    for (const k of ['github.branch_protected', 'github.review_required', 'github.merged_with_review', 'github.no_critical_vulnerabilities', 'github.no_exposed_secrets']) {
      expect(byKey(r, k).status).toBe('unknown');
    }
  });

  it('does not count a self-approval or a bot approval as review', () => {
    expect(hasIndependentHumanApproval({ ...pr(1, 'thandi'), reviews: [approve('thandi')] })).toBe(false);
    expect(hasIndependentHumanApproval({ ...pr(1, 'thandi'), reviews: [approve('reviewbot[bot]', 'Bot')] })).toBe(false);
    expect(hasIndependentHumanApproval({ ...pr(1, 'thandi'), reviews: [approve('sipho')] })).toBe(true);
  });

  it('recognises AI-written pull requests by author or trailer', () => {
    expect(isAiAuthored(pr(1, 'Copilot', 'Bot'))).toBe(true);
    expect(isAiAuthored(pr(2, 'devin-ai-integration[bot]', 'Bot'))).toBe(true);
    expect(isAiAuthored(pr(3, 'thandi', 'User', { body: 'Fix\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)' }))).toBe(true);
    expect(isAiAuthored(pr(4, 'thandi', 'User', { body: 'Co-Authored-By: Claude <noreply@anthropic.com>' }))).toBe(true);
    expect(isAiAuthored(pr(5, 'thandi'))).toBe(false);
  });

  it('fails AI-written changes merged without a person approving, and lists them', () => {
    const r = evaluateRepo(facts({
      mergedPulls: [
        { ...pr(10, 'Copilot', 'Bot'), reviews: [] },
        { ...pr(11, 'Copilot', 'Bot'), reviews: [approve('sipho')] },
        { ...pr(12, 'thandi'), reviews: [approve('sipho')] },
      ],
    }));
    const ai = byKey(r, 'github.ai_changes_reviewed');
    expect(ai.status).toBe('fail');
    expect((ai.detail!.pulls as { number: number }[]).map((p) => p.number)).toEqual([10]);
    expect(byKey(r, 'github.merged_with_review').summary).toContain('1 of 3');
  });

  it('counts open vulnerability and secret alerts', () => {
    const r = evaluateRepo(facts({ openSevereVulnerabilities: 3, openSecretAlerts: 1 }));
    expect(byKey(r, 'github.no_critical_vulnerabilities')).toMatchObject({ status: 'fail', summary: '3 open critical or high Dependabot alerts.' });
    expect(byKey(r, 'github.no_exposed_secrets')).toMatchObject({ status: 'fail', summary: '1 leaked secret is still open.' });
  });

  it('flags AI libraries until the repository is linked to a declared system', () => {
    const pkgs = ['npm:openai', 'npm:react', 'pypi:scikit-learn'];
    expect(aiLibraries(pkgs)).toEqual(['Machine learning library', 'OpenAI SDK']);
    expect(byKey(evaluateRepo(facts({ packages: pkgs })), 'github.ai_usage_declared').status).toBe('fail');
    const sys = 'a1b2c3d4-0000-0000-0000-000000000000';
    expect(byKey(evaluateRepo(facts({ packages: pkgs }), { link: sys, declaredSystemIds: new Set([sys]) }), 'github.ai_usage_declared').status).toBe('pass');
    // A link to a system that has since been withdrawn no longer counts.
    expect(byKey(evaluateRepo(facts({ packages: pkgs }), { link: sys, declaredSystemIds: new Set() }), 'github.ai_usage_declared').status).toBe('fail');
    expect(byKey(evaluateRepo(facts({ packages: pkgs }), { link: 'none' }), 'github.ai_usage_declared').status).toBe('pass');
    // No AI libraries: no check at all, rather than a meaningless pass.
    expect(byKey(evaluateRepo(facts({ packages: ['npm:react'] })), 'github.ai_usage_declared')).toBeUndefined();
  });

  it('reads package names from SBOM purls', () => {
    expect(packageNames([
      { name: 'npm:@anthropic-ai/sdk', externalRefs: [{ referenceLocator: 'pkg:npm/%40anthropic-ai/sdk@0.30.0' }] },
      { name: 'com.github.acme/lending-api' },
      { externalRefs: [{ referenceLocator: 'pkg:pypi/openai@1.40.0' }] },
    ])).toEqual(['npm:@anthropic-ai/sdk', 'com.github.acme/lending-api', 'pypi:openai']);
  });

  it('two-factor: unknown when the setting cannot be read', () => {
    expect(evaluateOrg2fa('acme', null).status).toBe('unknown');
    expect(evaluateOrg2fa('acme', false).status).toBe('fail');
    expect(evaluateOrg2fa('acme', true).status).toBe('pass');
  });
});

describe('GitHub App JWT', () => {
  it('is a valid RS256 token GitHub will accept', () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const pem = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
    const jwt = appJwt('12345', pem.replace(/\n/g, '\\n'), 1_800_000_000);
    const [h, p, s] = jwt.split('.');
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
    expect(payload).toEqual({ iat: 1_800_000_000 - 60, exp: 1_800_000_000 + 540, iss: '12345' });
    const v = createVerify('RSA-SHA256');
    v.update(`${h}.${p}`);
    expect(v.verify(publicKey, Buffer.from(s, 'base64url'))).toBe(true);
  });
});

describe('install state', () => {
  beforeAll(() => { process.env.INTEGRATIONS_STATE_SECRET = 'test-secret-test-secret-test-secret'; });
  it('round-trips, and rejects tampering and expiry', () => {
    const s = signState('org-1', 'user-1', NOW);
    expect(verifyState(s, NOW + 1000)).toEqual({ orgId: 'org-1', userId: 'user-1' });
    expect(verifyState(s, NOW + 31 * 60 * 1000)).toBeNull();
    const [body, mac] = s.split('.');
    const forged = Buffer.from(JSON.stringify({ o: 'org-2', u: 'user-1', e: NOW + 1e6 })).toString('base64url');
    expect(verifyState(`${forged}.${mac}`, NOW)).toBeNull();
    expect(verifyState(`${body}.x${mac.slice(1)}`, NOW)).toBeNull();
    expect(verifyState(null)).toBeNull();
  });
});

describe('provider usage mapping', () => {
  it('OpenAI: one row per model and day, with cost from line items', () => {
    const t = Date.parse('2026-10-01T00:00:00Z') / 1000;
    const rows = mapOpenAI(
      [{ start_time: t, end_time: t + 86400, results: [
        { model: 'gpt-4o-2024-08-06', input_tokens: 1000, output_tokens: 200, num_model_requests: 5 },
        { model: 'gpt-4o-2024-08-06', input_tokens: 500, output_tokens: 100, num_model_requests: 2 },
      ] }],
      [{ start_time: t, end_time: t + 86400, results: [
        { amount: { value: 0.75, currency: 'usd' }, line_item: 'gpt-4o-2024-08-06, input' },
        { amount: { value: 0.25, currency: 'usd' }, line_item: 'gpt-4o-2024-08-06, output' },
      ] }]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ provider: 'openai', model: 'gpt-4o-2024-08-06', requests: 7, inputTokens: 1500, outputTokens: 300, costUsd: 1 });
    expect(modelFromLineItem(null)).toBe('(unattributed)');
  });

  it('Anthropic: counts cached input, and reads cost in cents', () => {
    const rows = mapAnthropic(
      [{ starting_at: '2026-10-01T00:00:00Z', ending_at: '2026-10-02T00:00:00Z', results: [
        { model: 'claude-sonnet-4-5', uncached_input_tokens: 1000, cache_read_input_tokens: 200, cache_creation: { ephemeral_5m_input_tokens: 50, ephemeral_1h_input_tokens: 0 }, output_tokens: 300 },
      ] }],
      [{ starting_at: '2026-10-01T00:00:00Z', ending_at: '2026-10-02T00:00:00Z', results: [
        { model: 'claude-sonnet-4-5', amount: '250.5', currency: 'USD' },
      ] }]
    );
    expect(rows[0]).toMatchObject({ provider: 'anthropic', model: 'claude-sonnet-4-5', inputTokens: 1250, outputTokens: 300, requests: null });
    expect(rows[0].costUsd).toBeCloseTo(2.505);
  });

  it('turns away keys that cannot read organisation usage', () => {
    expect(keyShapeProblem('openai', 'sk-proj-abc')).toMatch(/admin key/);
    expect(keyShapeProblem('openai', 'sk-admin-abc')).toBeNull();
    expect(keyShapeProblem('anthropic', 'sk-ant-api03-abc')).toMatch(/Admin API key/);
    expect(keyShapeProblem('anthropic', 'sk-ant-admin01-abc')).toBeNull();
  });
});

describe('AI provider checks', () => {
  const base = {
    provider: 'openai' as const,
    connectedAt: new Date(NOW - 10 * 86_400_000),
    declaredSystemIds: new Set(['sys-1']),
    declaredSystemNames: new Set(['loan pre-screening']),
    links: {} as Record<string, string>,
    now: NOW,
  };
  const row = (model: string, ageDays: number, systemName: string | null = null) => ({ model, systemName, periodEnd: new Date(NOW - ageDays * 86_400_000), tokens: 100 });

  it('waits politely for a new connection, then fails a silent one', () => {
    expect(byKey(evaluateProvider({ ...base, rows: [], connectedAt: new Date(NOW - 3600_000) }), 'ai.usage_fresh').status).toBe('warn');
    expect(byKey(evaluateProvider({ ...base, rows: [] }), 'ai.usage_fresh').status).toBe('fail');
    expect(byKey(evaluateProvider({ ...base, rows: [row('gpt-4o', 1)] }), 'ai.usage_fresh').status).toBe('pass');
    expect(byKey(evaluateProvider({ ...base, rows: [row('gpt-4o', 5)] }), 'ai.usage_fresh').summary).toContain('5 days old');
  });

  it('covers a model by attribution from the exporter, or by a link', () => {
    expect(byKey(evaluateProvider({ ...base, rows: [row('gpt-4o', 1, 'Loan pre-screening')] }), 'ai.models_declared').status).toBe('pass');
    const unlinked = byKey(evaluateProvider({ ...base, rows: [row('gpt-4o', 1), row('o3', 1)] }), 'ai.models_declared');
    expect(unlinked.status).toBe('fail');
    expect(byKey(evaluateProvider({ ...base, rows: [row('gpt-4o', 1), row('o3', 1)], links: { 'gpt-4o': 'sys-1', o3: 'none' } }), 'ai.models_declared').status).toBe('pass');
  });
});

describe('continuity record', () => {
  const state = (checks?: Record<string, string>): EstateState => ({
    systems: {}, persons: {}, findings: {}, undeclared: {}, decidingNames: [], certificate: null, evidenceLastVerifiedAt: null, ...(checks ? { checks } : {}),
  });
  const k = 'github.branch_protected|acme/lending-api';

  it('records a check that starts failing, and passes again, but not a new pass', () => {
    expect(diffEstate(state({}), state({ [k]: 'pass' }))).toEqual([]);
    const started = diffEstate(state({ [k]: 'pass' }), state({ [k]: 'fail' }));
    expect(started).toHaveLength(1);
    expect(narrateEvent(started[0])).toBe('Check started failing: Main branch is protected (acme/lending-api).');
    expect(narrateEvent(diffEstate(state({ [k]: 'fail' }), state({ [k]: 'pass' }))[0])).toBe('Check passes again: Main branch is protected (acme/lending-api).');
  });

  it('treats a snapshot from before connected systems as having no checks', () => {
    const changes = diffEstate(state(), state({ [k]: 'fail', 'github.review_required|acme/lending-api': 'pass' }));
    expect(changes.map((c) => c.newValue)).toEqual(['fail']);
    expect(CHECK_BY_KEY['github.branch_protected']).toBeDefined();
  });
});
