// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { CATALOGUE, DEFAULT_SELECTION, CATALOGUE_BY_KEY } from '@/lib/frameworks/catalog';
import { COMMON_BY_KEY, COMMON_CONTROLS, controlFromSlot, controlSlot } from '@/lib/common-controls';
import { suggestControls, parseRequirementList, validateCustom } from '@/lib/frameworks/custom';
import { coverage, evaluateFramework, evaluateCommon } from '@/lib/controls';

describe('framework catalogue', () => {
  it('has the frameworks Vanta lists, plus POPIA and NIST CSF', () => {
    const keys = CATALOGUE.map((f) => f.key);
    for (const k of ['soc2', 'iso27001', 'gdpr', 'hipaa', 'hitrust', 'usdp', 'nist_ai_rmf', 'iso42001', 'cmmc', 'cjis', 'nis2', 'dora', 'cps234', 'eu_ai_act', 'essential_eight', 'cyber_essentials', 'fedramp', 'cri', 'popia', 'nist_csf']) {
      expect(keys, k).toContain(k);
    }
    for (const k of DEFAULT_SELECTION) expect(CATALOGUE_BY_KEY[k], k).toBeDefined();
  });

  it('every requirement is unique within its framework and names only known common controls', () => {
    for (const f of CATALOGUE) {
      expect(f.requirements.length, f.key).toBeGreaterThan(0);
      expect(new Set(f.requirements.map((r) => r.id)).size, f.key).toBe(f.requirements.length);
      for (const r of f.requirements) for (const k of r.controls) expect(COMMON_BY_KEY[k], `${f.key} ${r.id} ${k}`).toBeDefined();
      expect(f.sources.length, f.key).toBeGreaterThan(0);
    }
  });

  it('every common control is used by some framework', () => {
    const used = new Set(CATALOGUE.flatMap((f) => f.requirements.flatMap((r) => r.controls)));
    for (const c of COMMON_CONTROLS) expect(used.has(c.key), c.key).toBe(true);
  });

  it('coverage leaves unmapped requirements out of the evidenced share', () => {
    const common = evaluateCommon({ checks: { 'github.org_2fa_required': ['pass'] }, policies: {}, requirements: {} }, (k) => k, (k) => k);
    const r = evaluateFramework('x', [
      { id: '1', title: 'MFA', controls: ['iam.mfa'] },
      { id: '2', title: 'Backups', controls: ['ops.backup'] },
      { id: '3', title: 'Physical locks', controls: [] },
    ], common);
    expect(r.map((c) => c.status)).toEqual(['evidenced', 'no_evidence', 'not_mapped']);
    expect(coverage(r)).toMatchObject({ total: 3, evidenced: 1, noEvidence: 1, notMapped: 1 });
  });
});

describe('documents filed against a control', () => {
  it('round-trips the slot type and rejects unknown controls', () => {
    expect(controlFromSlot(controlSlot('ops.backup'))).toBe('ops.backup');
    expect(controlSlot('ops.breach_notification').length).toBeLessThanOrEqual(50);
    expect(controlFromSlot('CONTROL:nope')).toBeNull();
    expect(controlFromSlot('policy')).toBeNull();
  });
});

describe('custom frameworks', () => {
  it('suggests controls from the wording', () => {
    expect(suggestControls('Suppliers must enforce multi-factor authentication for all staff')).toContain('iam.mfa');
    expect(suggestControls('Backups are tested at least annually')).toEqual(['ops.backup']);
    expect(suggestControls('Security incidents are reported to Acme within 24 hours')).toContain('ops.incident_response');
    expect(suggestControls('The office has a fire extinguisher')).toEqual([]);
  });

  it('parses a pasted list with or without references', () => {
    expect(parseRequirementList('4.1, Use MFA\n4.2\tTest backups\n\nA-3 - Encrypt laptops')).toEqual([
      { id: '4.1', title: 'Use MFA' }, { id: '4.2', title: 'Test backups' }, { id: 'A-3', title: 'Encrypt laptops' },
    ]);
    expect(parseRequirementList('Use MFA\nTest backups, quarterly')).toEqual([{ id: '1', title: 'Use MFA' }, { id: '2', title: 'Test backups, quarterly' }]);
  });

  it('validates', () => {
    expect(validateCustom({ name: '', requirements: [] })).toEqual({ error: 'Give the framework a name.' });
    expect(validateCustom({ name: 'A', requirements: [] })).toEqual({ error: 'Add at least one requirement.' });
    expect(validateCustom({ name: 'A', requirements: [{ id: '1', title: 'x', controls: ['nope'] }] })).toEqual({ error: 'Requirement 1 names a control AIC does not know: nope.' });
    expect(validateCustom({ name: 'A', requirements: [{ id: '1', title: 'x' }, { id: '1', title: 'y' }] })).toEqual({ error: 'Two requirements share the reference 1.' });
    const ok = validateCustom({ name: ' Acme ', requirements: [{ title: 'Use MFA', controls: ['iam.mfa', 'iam.mfa'] }] });
    expect(ok).toEqual({ value: { name: 'Acme', description: null, requirements: [{ id: '1', title: 'Use MFA', controls: ['iam.mfa'] }] } });
  });
});
