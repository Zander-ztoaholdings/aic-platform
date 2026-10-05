// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { evidenceState, summariseByRight, type VaultDocument, type VaultRequirement } from '@/lib/evidence-vault';

const doc = (over: Partial<VaultDocument>): VaultDocument => ({
  id: Math.random().toString(36), title: 'f.pdf', fileSize: null, createdAt: '2026-10-01T00:00:00Z',
  verificationOutcome: null, verificationNotes: null, verifiedAt: null, supersededBy: null, ...over,
});

describe('evidence state', () => {
  it('reads nothing filed, waiting, accepted and sent back', () => {
    expect(evidenceState([])).toBe('missing');
    expect(evidenceState([doc({})])).toBe('submitted');
    expect(evidenceState([doc({ verificationOutcome: 'ACCEPTED' })])).toBe('accepted');
    expect(evidenceState([doc({ verificationOutcome: 'INSUFFICIENT' })])).toBe('needs_more');
  });
  it('a fresh file after a rejection is waiting again, not still rejected', () => {
    expect(evidenceState([
      doc({ verificationOutcome: 'REJECTED', createdAt: '2026-10-01T00:00:00Z' }),
      doc({ createdAt: '2026-10-03T00:00:00Z' }),
    ])).toBe('submitted');
  });
  it('ignores superseded files', () => {
    expect(evidenceState([doc({ verificationOutcome: 'ACCEPTED', supersededBy: 'x' })])).toBe('missing');
  });
});

describe('summary by Right', () => {
  it('counts per Right in the standard order, with names when published', () => {
    const req = (code: string, right: string, state: VaultRequirement['state']): VaultRequirement => ({
      id: code, code, rightCode: right, text: '', evidenceGuidance: null, tier: null, state, documents: [],
    });
    const s = summariseByRight(
      [req('TR-1', 'TR', 'missing'), req('HU-1', 'HU', 'accepted'), req('HU-2', 'HU', 'needs_more')],
      { HU: { name: 'Human Agency', blurb: 'b' } }
    );
    expect(s.map((r) => r.code)).toEqual(['HU', 'TR']);
    expect(s[0]).toMatchObject({ name: 'Human Agency', total: 2, accepted: 1, needsMore: 1 });
    expect(s[1]).toMatchObject({ name: null, total: 1, missing: 1 });
  });
});
