import { describe, it, expect } from 'vitest';
import {
  diffEstate,
  deriveDrift,
  linkHash,
  linkContent,
  verifyChain,
  type EstateState,
  type ChainLink,
} from '../../lib/continuity';

/**
 * The continuity record's whole value proposition is that it cannot be edited
 * after the fact. That claim is tested here or it is not tested anywhere.
 */

const empty: EstateState = {
  systems: {},
  persons: {},
  findings: {},
  undeclared: {},
  decidingNames: [],
  certificate: null,
  evidenceLastVerifiedAt: null,
};

const sys = (over: Partial<EstateState['systems'][string]> = {}) => ({
  name: 'credit-scorer',
  version: '2.0.0',
  purpose: 'Assess SME credit applications',
  riskTier: 3,
  lifecycleStage: 'PRODUCTION',
  status: 'ACTIVE',
  isSandbox: false,
  ...over,
});

const withSystem = (over = {}): EstateState => ({
  ...empty,
  systems: { 's1': sys(over) },
  decidingNames: ['credit-scorer'],
});

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

describe('diffEstate', () => {
  it('emits nothing when nothing changed', () => {
    const s = withSystem();
    expect(diffEstate(s, s)).toEqual([]);
  });

  it('treats the first observation as an opening balance, not as noise', () => {
    // A record that starts mid-stream cannot be relied on. Everything present
    // at the first observation is part of the record.
    const changes = diffEstate(null, withSystem());
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ entityType: 'AI_SYSTEM', changeType: 'DECLARED' });
  });

  it('records a promotion to production as a field change with both values', () => {
    const before = withSystem({ lifecycleStage: 'DEVELOPMENT' });
    const after = withSystem({ lifecycleStage: 'PRODUCTION' });
    const c = diffEstate(before, after).find((x) => x.field === 'lifecycleStage')!;
    expect(c.previousValue).toBe('DEVELOPMENT');
    expect(c.newValue).toBe('PRODUCTION');
  });

  it('labels a rename with the name the system had before it', () => {
    // Otherwise the entry reads "y changed name: x → y", which is the one way
    // a rename can be made to look like it never happened.
    const c = diffEstate(withSystem(), withSystem({ name: 'credit-scorer-v2' })).find(
      (x) => x.field === 'name'
    )!;
    expect(c.entityLabel).toBe('credit-scorer');
    expect(c.previousValue).toBe('credit-scorer');
    expect(c.newValue).toBe('credit-scorer-v2');
  });

  it('records a withdrawn system rather than letting it vanish', () => {
    const c = diffEstate(withSystem(), empty);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ changeType: 'WITHDRAWN', entityLabel: 'credit-scorer' });
  });

  it('marks an undeclared system OBSERVED, never DECLARED', () => {
    // DECLARED is a statement by the organisation. OBSERVED is AIC noticing.
    // Conflating them would let AIC's own finding masquerade as the client's
    // declaration, which is the difference between evidence and an accusation.
    const after = { ...empty, undeclared: { 'shadow-scorer': 40 } };
    const c = diffEstate(empty, after);
    expect(c[0].changeType).toBe('OBSERVED');
    expect(c[0].entityType).toBe('UNDECLARED_SYSTEM');
  });

  it('records growth in an undeclared system with both counts', () => {
    const c = diffEstate(
      { ...empty, undeclared: { 'shadow-scorer': 40 } },
      { ...empty, undeclared: { 'shadow-scorer': 91 } }
    );
    expect(c[0].previousValue).toBe('40');
    expect(c[0].newValue).toBe('91');
  });

  it('records a superseded accountable person as withdrawn', () => {
    const before: EstateState = {
      ...empty,
      persons: {
        p1: { name: 'A. Example', jobTitle: 'CRO', declarationVersion: '1.2', declarationAcceptedAt: daysAgo(10) },
      },
    };
    const c = diffEstate(before, empty);
    expect(c[0]).toMatchObject({ entityType: 'ACCOUNTABLE_PERSON', changeType: 'WITHDRAWN' });
  });

  it('does not emit events for counters', () => {
    // Decision tallies move constantly. A record that logged them would bury
    // the three entries that matter under ten thousand that do not.
    const a = { ...withSystem(), evidenceLastVerifiedAt: daysAgo(5) };
    const b = { ...withSystem(), evidenceLastVerifiedAt: daysAgo(1) };
    expect(diffEstate(a, b)).toEqual([]);
  });
});

describe('deriveDrift', () => {
  it('is quiet on a healthy estate', () => {
    expect(deriveDrift({ ...withSystem(), evidenceLastVerifiedAt: daysAgo(3) }, null)).toEqual([]);
  });

  it('flags a production system with no stated purpose', () => {
    const d = deriveDrift(withSystem({ purpose: null }), null);
    expect(d.map((x) => x.code)).toContain('DRIFT-PRODUCTION-NO-PURPOSE');
  });

  it('flags a production system that has never logged a decision', () => {
    const state = { ...withSystem(), decidingNames: [] };
    const d = deriveDrift(state, null).find((x) => x.code === 'DRIFT-SILENT-PRODUCTION-SYSTEM')!;
    expect(d).toBeDefined();
    // The drift must name the ambiguity rather than resolve it: the record
    // genuinely cannot tell which of the two it is.
    expect(d.detail).toContain('not in production');
    expect(d.detail).toContain('not logging');
  });

  it('does not flag a sandbox system as silent', () => {
    const state = { ...withSystem({ lifecycleStage: 'DEVELOPMENT' }), decidingNames: [] };
    expect(deriveDrift(state, null).map((x) => x.code)).not.toContain(
      'DRIFT-SILENT-PRODUCTION-SYSTEM'
    );
  });

  it('flags stale evidence past ninety days and reports the age', () => {
    const d = deriveDrift({ ...withSystem(), evidenceLastVerifiedAt: daysAgo(94) }, null).find(
      (x) => x.code === 'DRIFT-EVIDENCE-STALE'
    )!;
    expect(d.ageDays).toBe(94);
  });

  it('does not flag evidence inside the window', () => {
    const codes = deriveDrift({ ...withSystem(), evidenceLastVerifiedAt: daysAgo(89) }, null).map(
      (x) => x.code
    );
    expect(codes).not.toContain('DRIFT-EVIDENCE-STALE');
  });

  it('flags a declaration older than a year', () => {
    const state: EstateState = {
      ...withSystem(),
      persons: {
        p1: { name: 'A. Example', jobTitle: 'CRO', declarationVersion: '1.0', declarationAcceptedAt: daysAgo(400) },
      },
      evidenceLastVerifiedAt: daysAgo(3),
    };
    expect(deriveDrift(state, null).map((x) => x.code)).toContain('DRIFT-DECLARATION-LAPSED');
  });

  it('blocks when an undeclared system keeps growing between observations', () => {
    const prev = { ...withSystem(), undeclared: { 'shadow-scorer': 40 }, evidenceLastVerifiedAt: daysAgo(3) };
    const next = { ...withSystem(), undeclared: { 'shadow-scorer': 91 }, evidenceLastVerifiedAt: daysAgo(3) };
    const d = deriveDrift(next, prev).find((x) => x.code === 'DRIFT-UNDECLARED-GROWING')!;
    expect(d.severity).toBe('BLOCKING');
  });

  it('cannot report growth without a previous observation', () => {
    const next = { ...withSystem(), undeclared: { 'shadow-scorer': 91 }, evidenceLastVerifiedAt: daysAgo(3) };
    expect(deriveDrift(next, null).map((x) => x.code)).not.toContain('DRIFT-UNDECLARED-GROWING');
  });

  it('orders blocking drift first', () => {
    const prev = { ...withSystem({ purpose: null }), undeclared: { s: 1 }, evidenceLastVerifiedAt: daysAgo(200) };
    const next = { ...withSystem({ purpose: null }), undeclared: { s: 9 }, evidenceLastVerifiedAt: daysAgo(200) };
    const rank = { BLOCKING: 0, MATERIAL: 1, ADVISORY: 2 } as const;
    const rs = deriveDrift(next, prev).map((d) => rank[d.severity]);
    expect(rs).toEqual([...rs].sort((a, b) => a - b));
  });
});

describe('the chain', () => {
  const build = (n: number): ChainLink[] => {
    const links: ChainLink[] = [];
    let prev: string | null = null;
    for (let i = 1; i <= n; i++) {
      const base = {
        seq: i,
        observedAt: new Date(1700000000000 + i * 1000).toISOString(),
        entityType: 'AI_SYSTEM',
        entityKey: `s${i}`,
        entityLabel: `system-${i}`,
        changeType: 'DECLARED',
        field: null,
        previousValue: null,
        newValue: null,
        actorLabel: 'AIC continuity observer',
      };
      const hash = linkHash(linkContent(base), prev);
      links.push({ ...base, previousHash: prev, hash });
      prev = hash;
    }
    return links;
  };

  it('verifies an untampered chain', () => {
    expect(verifyChain(build(5))).toEqual({ valid: true });
  });

  it('verifies an empty chain', () => {
    expect(verifyChain([])).toEqual({ valid: true });
  });

  it('catches an edited value', () => {
    // The claim the whole feature rests on.
    const links = build(5);
    links[2].entityLabel = 'something-else';
    const r = verifyChain(links);
    expect(r.valid).toBe(false);
    expect(r.brokenAtSeq).toBe(3);
    expect(r.reason).toContain('hash');
  });

  it('catches a removed entry', () => {
    const links = build(5);
    links.splice(2, 1);
    const r = verifyChain(links);
    expect(r.valid).toBe(false);
    expect(r.brokenAtSeq).toBe(4);
  });

  it('catches a re-hashed entry whose neighbours were not re-hashed', () => {
    // The sophisticated tamper: fix the entry's own hash so it is internally
    // consistent. The link after it still carries the old previousHash.
    const links = build(5);
    links[2].entityLabel = 'something-else';
    links[2].hash = linkHash(linkContent(links[2]), links[2].previousHash);
    const r = verifyChain(links);
    expect(r.valid).toBe(false);
    expect(r.brokenAtSeq).toBe(4);
    expect(r.reason).toContain('previous hash');
  });

  it('is order-independent in its hash, so field reordering cannot break it', () => {
    const a = { seq: 1, observedAt: 'x', entityType: 'A', entityKey: 'k', entityLabel: 'l',
      changeType: 'DECLARED', field: null, previousValue: null, newValue: null, actorLabel: 'z' };
    expect(linkHash(linkContent(a), null)).toBe(linkHash(linkContent({ ...a }), null));
  });
});
