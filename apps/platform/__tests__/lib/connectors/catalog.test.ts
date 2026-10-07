import { describe, it, expect } from 'vitest';
import { CONNECTORS, CONNECTOR_CHECKS } from '@/lib/connectors/catalog';
import { IMPLS } from '@/lib/connectors/registry';
import { CHECKS, CHECK_BY_KEY } from '@/lib/integrations/catalog';
import { COMMON_BY_KEY } from '@/lib/common-controls';

describe('connector catalogue', () => {
  it('has 26 connectors, each with an implementation', () => {
    expect(CONNECTORS).toHaveLength(26);
    for (const c of CONNECTORS) expect(IMPLS[c.key], c.key).toBeDefined();
  });
  it('reads AI use wherever the catalogue says it does', () => {
    for (const c of CONNECTORS) if (c.ai) expect(IMPLS[c.key].aiUse, `${c.key} aiUse`).toBeTypeOf('function');
  });
  it('gives accounts and people only where implemented', () => {
    for (const c of CONNECTORS) {
      if (c.accounts) expect(IMPLS[c.key].accounts, `${c.key} accounts`).toBeTypeOf('function');
      if (c.people) expect(IMPLS[c.key].people, `${c.key} people`).toBeTypeOf('function');
    }
  });
  it('maps every check to common controls that exist', () => {
    for (const k of CONNECTOR_CHECKS) {
      expect(k.common.length, k.key).toBeGreaterThan(0);
      for (const c of k.common) expect(COMMON_BY_KEY[c], `${k.key} → ${c}`).toBeDefined();
      expect(COMMON_BY_KEY[k.common[0]].sources.some((s) => s.kind === 'check' && s.key === k.key)).toBe(true);
    }
  });
  it('check keys are unique and start with the connector key', () => {
    expect(new Set(CHECKS.map((c) => c.key)).size).toBe(CHECKS.length);
    for (const k of CONNECTOR_CHECKS) {
      expect(k.key.startsWith(k.connector + '.'), k.key).toBe(true);
      expect(CHECK_BY_KEY[k.key].source).toBe('connector');
    }
  });
  it('every field key is unique within a connector, and secrets are marked', () => {
    for (const c of CONNECTORS) {
      expect(new Set(c.fields.map((f) => f.key)).size, c.key).toBe(c.fields.length);
      for (const f of c.fields) if (/token|secret|key$/i.test(f.key) && f.key !== 'accessKeyId') expect(f.kind, `${c.key}.${f.key}`).toBe('secret');
    }
  });
});
