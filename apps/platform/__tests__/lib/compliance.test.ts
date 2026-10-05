// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';
import { evaluateTenant } from '@/lib/integrations/microsoft-checks';
import type { TenantFacts } from '@/lib/integrations/microsoft';
import { rollUp, sourceStatus, evaluateControls, evaluateCommon, type EvidenceInput } from '@/lib/controls';
import { COMMON_CONTROLS } from '@/lib/common-controls';
import { validGitHubSignature } from '@/lib/integrations/webhook';
import { POLICY_TEMPLATES } from '@/lib/policy-templates';
import { CHECK_BY_KEY } from '@/lib/integrations/catalog';
import { bodyHash } from '@/lib/policy-hash';

const NOW = Date.parse('2026-10-05T12:00:00Z');
const facts = (over: Partial<TenantFacts> = {}): TenantFacts => ({
  tenantName: 'Karoo', securityDefaults: false, caPolicies: [], registrations: [], globalAdmins: [{}, {}], users: [], ...over,
});
const byKey = (rs: { checkKey: string }[], k: string) => rs.find((r) => r.checkKey === k) as unknown as { status: string; summary: string; detail?: { people?: unknown[] } };

describe('Microsoft 365 checks', () => {
  it('MFA enforced by security defaults or an all-users Conditional Access policy', () => {
    expect(byKey(evaluateTenant('t', facts({ securityDefaults: true })), 'm365.mfa_enforced').status).toBe('pass');
    expect(byKey(evaluateTenant('t', facts({ caPolicies: [{ displayName: 'MFA all', state: 'enabled', conditions: { users: { includeUsers: ['All'] } }, grantControls: { builtInControls: ['mfa'] } }] })), 'm365.mfa_enforced').status).toBe('pass');
    // Report-only or scoped to some users does not count.
    expect(byKey(evaluateTenant('t', facts({ caPolicies: [{ displayName: 'x', state: 'enabledForReportingButNotEnforced', conditions: { users: { includeUsers: ['All'] } }, grantControls: { builtInControls: ['mfa'] } }] })), 'm365.mfa_enforced').status).toBe('fail');
    expect(byKey(evaluateTenant('t', facts({ securityDefaults: null, caPolicies: null })), 'm365.mfa_enforced').status).toBe('unknown');
  });

  it('names members without a second factor, administrators first in the summary', () => {
    const r = byKey(evaluateTenant('t', facts({ registrations: [
      { userPrincipalName: 'a@k', isMfaRegistered: true, userType: 'member' },
      { userPrincipalName: 'b@k', isMfaRegistered: false, isAdmin: true, userType: 'member' },
      { userPrincipalName: 'g@x', isMfaRegistered: false, userType: 'guest' },
    ] })), 'm365.mfa_registered');
    expect(r.status).toBe('fail');
    expect(r.summary).toBe('1 of 2 members have no second factor registered, 1 of them administrators.');
    expect(byKey(evaluateTenant('t', facts({ registrations: null })), 'm365.mfa_registered').status).toBe('unknown');
  });

  it('global administrators: two to four', () => {
    expect(byKey(evaluateTenant('t', facts({ globalAdmins: [{}] })), 'm365.global_admins').status).toBe('warn');
    expect(byKey(evaluateTenant('t', facts({ globalAdmins: [{}, {}, {}] })), 'm365.global_admins').status).toBe('pass');
    expect(byKey(evaluateTenant('t', facts({ globalAdmins: [{}, {}, {}, {}, {}] })), 'm365.global_admins').status).toBe('fail');
  });

  it('stale accounts need sign-in data, and count only enabled members', () => {
    expect(byKey(evaluateTenant('t', facts({ users: [{ userPrincipalName: 'a', accountEnabled: true }] }), NOW), 'm365.stale_accounts').status).toBe('unknown');
    const old = new Date(NOW - 120 * 86400000).toISOString();
    const recent = new Date(NOW - 5 * 86400000).toISOString();
    const r = byKey(evaluateTenant('t', facts({ users: [
      { userPrincipalName: 'old', accountEnabled: true, userType: 'Member', signInActivity: { lastSignInDateTime: old } },
      { userPrincipalName: 'off', accountEnabled: false, userType: 'Member', signInActivity: { lastSignInDateTime: old } },
      { userPrincipalName: 'now', accountEnabled: true, userType: 'Member', signInActivity: { lastSignInDateTime: recent } },
      { userPrincipalName: 'never', accountEnabled: true, userType: 'Member', createdDateTime: old, signInActivity: { lastSignInDateTime: null } },
    ] }), NOW), 'm365.stale_accounts');
    expect(r.status).toBe('fail');
    expect(r.detail!.people).toHaveLength(2);
  });
});

describe('controls', () => {
  it('every check and policy a control names exists', () => {
    const policies = new Set(POLICY_TEMPLATES.map((p) => p.key));
    for (const c of COMMON_CONTROLS) for (const s of c.sources) {
      if (s.kind === 'check') expect(CHECK_BY_KEY[s.key], s.key).toBeDefined();
      if (s.kind === 'policy') expect(policies.has(s.key), s.key).toBe(true);
    }
  });

  it('rolls evidence up: any failure is a gap; all passing is evidenced', () => {
    expect(rollUp(['pass', 'fail'])).toBe('gap');
    expect(rollUp(['pass', 'pass'])).toBe('evidenced');
    expect(rollUp(['pass', 'none'])).toBe('partial');
    expect(rollUp(['none'])).toBe('no_evidence');
  });

  it('a policy counts once published and accepted by everyone', () => {
    const e = (p: EvidenceInput['policies']): EvidenceInput => ({ checks: {}, requirements: {}, policies: p });
    expect(sourceStatus({ kind: 'policy', key: 'x' }, e({})).status).toBe('none');
    expect(sourceStatus({ kind: 'policy', key: 'x' }, e({ x: { id: '1', published: true, acceptedAll: false } })).status).toBe('pending');
    expect(sourceStatus({ kind: 'policy', key: 'x' }, e({ x: { id: '1', published: true, acceptedAll: true } })).status).toBe('pass');
  });

  it('a check with any failing subject fails the source', () => {
    const r = evaluateControls({ checks: { 'github.branch_protected': ['pass', 'fail'] }, policies: {}, requirements: {} }, (k) => k, (k) => k);
    expect(r.find((c) => c.framework === 'iso27001' && c.id === 'A.8.4')!.status).toBe('gap');
  });

  it('a source that does not apply is left out; a document filed counts', () => {
    const none = evaluateCommon({ checks: {}, policies: {}, requirements: {} }, (k) => k, (k) => k);
    expect(none.find((c) => c.key === 'iam.mfa')!.status).toBe('no_evidence');
    const gh = evaluateCommon({ checks: { 'github.org_2fa_required': ['pass'] }, policies: {}, requirements: {} }, (k) => k, (k) => k);
    expect(gh.find((c) => c.key === 'iam.mfa')!.status).toBe('evidenced');
    const doc = evaluateCommon({ checks: {}, policies: {}, requirements: {}, documents: { 'ops.backup': { state: 'submitted', count: 1 } } }, (k) => k, (k) => k);
    expect(doc.find((c) => c.key === 'ops.backup')!.status).toBe('partial');
  });

  it('one check counts across frameworks; unmapped requirements say so', () => {
    const r = evaluateControls({ checks: { 'm365.mfa_enforced': ['pass'], 'm365.mfa_registered': ['pass'] }, policies: {}, requirements: {} }, (k) => k, (k) => k);
    expect(r.find((c) => c.framework === 'iso27001' && c.id === 'A.8.5')!.status).toBe('evidenced');
    expect(r.filter((c) => c.framework === 'soc2' && c.controls?.includes('iam.mfa')).every((c) => c.status !== 'no_evidence')).toBe(true);
    expect(r.some((c) => c.framework === 'iso27001' && c.status === 'not_mapped')).toBe(true);
  });

  it('lists one AIC control per requirement', () => {
    const r = evaluateControls({ checks: {}, policies: {}, requirements: { 'HU-2': { id: 'a', state: 'accepted', text: 't', right: 'HU' }, 'HU-10': { id: 'b', state: 'missing', text: 't', right: 'HU' } } }, (k) => k, (k) => k);
    expect(r.filter((c) => c.framework === 'aic').map((c) => [c.id, c.status])).toEqual([['HU-2', 'evidenced'], ['HU-10', 'no_evidence']]);
  });
});

describe('policies', () => {
  it('templates have unfilled placeholders, so they cannot be published as-is', () => {
    for (const t of POLICY_TEMPLATES) expect(/\[[^\]]{2,60}\]/.test(t.body), t.key).toBe(true);
  });
  it('a version fingerprint changes with the text', () => {
    expect(bodyHash('A', 'x')).not.toBe(bodyHash('A', 'y'));
    expect(bodyHash('A', 'x')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('GitHub webhook signature', () => {
  it('accepts only GitHub-signed bodies', () => {
    const body = '{"action":"deleted"}';
    const sig = 'sha256=' + createHmac('sha256', 's3cret').update(body).digest('hex');
    expect(validGitHubSignature(body, sig, 's3cret')).toBe(true);
    expect(validGitHubSignature(body + ' ', sig, 's3cret')).toBe(false);
    expect(validGitHubSignature(body, sig, undefined)).toBe(false);
    expect(validGitHubSignature(body, null, 's3cret')).toBe(false);
  });
});
