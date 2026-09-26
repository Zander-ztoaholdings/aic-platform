import { describe, it, expect } from 'vitest';
import {
  generateBadgeCode, normaliseBadgeCode, badgeExpiry, badgeStatus, BADGE_CODE_RE,
} from '../../lib/aware/badge';
import { pinnedInstrument, sanitisePartialAnswers, validateCompleteAnswers } from '../../lib/aware/instrument';

describe('badge codes', () => {
  it('produces the published format', () => {
    for (let i = 0; i < 200; i++) expect(generateBadgeCode()).toMatch(BADGE_CODE_RE);
  });
  it('is deterministic for given bytes and covers the alphabet ends', () => {
    expect(generateBadgeCode(Buffer.from([0, 0, 0, 0, 0]))).toBe('AWR-0000-0000');
    expect(generateBadgeCode(Buffer.from([255, 255, 255, 255, 255]))).toBe('AWR-ZZZZ-ZZZZ');
  });
  it('normalises typed input and rejects junk', () => {
    expect(normaliseBadgeCode(' awr-ab1o-il23 ')).toBe('AWR-AB10-1123');
    expect(normaliseBadgeCode('acme-corp')).toBeNull();
    expect(normaliseBadgeCode('AWR-UUUU-0000')).toBeNull();
  });
});

describe('badge expiry and status', () => {
  it('expires twelve months after issue', () => {
    expect(badgeExpiry(new Date('2026-09-26T10:00:00Z')).toISOString()).toBe('2027-09-26T10:00:00.000Z');
  });
  it('does not roll a leap day into March', () => {
    expect(badgeExpiry(new Date('2028-02-29T00:00:00Z')).toISOString()).toBe('2029-02-28T00:00:00.000Z');
  });
  it('reports revoked over expired, and expired at the boundary', () => {
    const now = new Date('2027-01-01T00:00:00Z');
    expect(badgeStatus({ expiresAt: '2027-06-01T00:00:00Z', revokedAt: null }, now)).toBe('valid');
    expect(badgeStatus({ expiresAt: now, revokedAt: null }, now)).toBe('expired');
    expect(badgeStatus({ expiresAt: '2026-01-01T00:00:00Z', revokedAt: '2026-02-01T00:00:00Z' }, now)).toBe('revoked');
  });
});

describe('answer validation against the pinned question set', () => {
  const inst = pinnedInstrument();
  const complete = Object.fromEntries(inst.questions.map((q) => [q.id, q.options[0].value]));

  it('has a versioned, non-empty question set', () => {
    expect(inst.version).toMatch(/^[0-9a-f]{12}$/);
    expect(inst.questions.length).toBeGreaterThan(0);
  });
  it('accepts a complete answer set', () => {
    expect(validateCompleteAnswers(complete, inst)).toEqual([]);
  });
  it('rejects missing, invented and out-of-range answers', () => {
    const { [inst.questions[0].id]: _drop, ...missing } = complete;
    expect(validateCompleteAnswers(missing, inst)).toHaveLength(1);
    expect(validateCompleteAnswers({ ...complete, q999: 1 }, inst)).toHaveLength(1);
    expect(validateCompleteAnswers({ ...complete, [inst.questions[0].id]: 97 }, inst)).toHaveLength(1);
  });
  it('keeps only valid partial answers on autosave', () => {
    const q = inst.questions[0];
    expect(sanitisePartialAnswers({ [q.id]: q.options[1].value, q999: 1, [inst.questions[1].id]: 'x' }, inst))
      .toEqual({ [q.id]: q.options[1].value });
    expect(sanitisePartialAnswers(null, inst)).toEqual({});
  });
});
