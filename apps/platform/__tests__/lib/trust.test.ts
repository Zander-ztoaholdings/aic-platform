import { describe, it, expect } from 'vitest';
import { buildTrustView, normaliseSections, suggestSlug, SLUG_RE, DEFAULT_SECTIONS } from '@/lib/trust';
import type { OrgFacts } from '@/lib/org-facts';

const facts: OrgFacts = {
  org: { id: 'o', name: 'Karoo', legalName: 'Karoo Lending (Pty) Ltd', division: 2, website: null },
  badge: { code: 'AWR-ABCD-EFGH', issuedAt: '2026-10-01T00:00:00Z', expiresAt: '2027-10-01T00:00:00Z', status: 'valid' },
  certificate: null,
  accountablePerson: { name: 'Thandi', jobTitle: 'COO', since: '2026-09-01T00:00:00Z' },
  policies: [{ key: 'information-security', title: 'Information security policy', version: 1, publishedAt: null, accepted: 1, members: 1 }],
  connectors: [{ provider: 'GitHub', label: 'acme', lastChecked: '2026-10-05T00:00:00Z' }],
  checks: [
    { key: 'github.branch_protected', subject: 'a/b', status: 'pass', summary: '', observedAt: null },
    { key: 'github.branch_protected', subject: 'a/c', status: 'fail', summary: '', observedAt: null },
  ],
  systems: [{ name: 'Claims triage', purpose: 'Sorts claims', riskTier: 2, stage: 'PRODUCTION' }],
  decisions: { last90: 0, overrides: 0 },
};

describe('trust pages', () => {
  it('shows only the sections switched on', () => {
    const v = buildTrustView(facts, DEFAULT_SECTIONS, { frameworks: [], controls: [] }, { intro: null, contactEmail: null, updatedAt: '' });
    expect(v.name).toBe('Karoo Lending (Pty) Ltd');
    expect(v.badge?.code).toBe('AWR-ABCD-EFGH');
    expect(v.systems).toBeUndefined();
    expect(v.monitoring).toBeUndefined();
  });
  it('monitoring reports counts by area, never which repository failed', () => {
    const v = buildTrustView(facts, { ...DEFAULT_SECTIONS, monitoring: true }, { frameworks: [], controls: [] }, { intro: null, contactEmail: null, updatedAt: '' });
    expect(v.monitoring?.areas).toEqual([{ area: 'Code and change control', passing: 1, total: 2 }]);
    expect(JSON.stringify(v.monitoring)).not.toContain('a/c');
  });
  it('normalises sections and slugs', () => {
    expect(normaliseSections({ systems: true, bogus: true }).systems).toBe(true);
    expect(normaliseSections(null)).toEqual(DEFAULT_SECTIONS);
    expect(suggestSlug('Karoo Lending (Pty) Ltd')).toBe('karoo-lending');
    expect(SLUG_RE.test('karoo-lending')).toBe(true);
    expect(SLUG_RE.test('-bad')).toBe(false);
  });
});
