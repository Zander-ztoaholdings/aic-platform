import { describe, it, expect, beforeAll } from 'vitest';
import { validateCallbackUrl, signCallback, verifyCallback, orgCallbackSecret, reviewDeadline, isExpired, isPrivateAddress, publicReview } from '@/lib/decision-review';

beforeAll(() => { process.env.INTEGRATIONS_STATE_SECRET = 'test-secret-value-long-enough'; });

describe('decision review', () => {
  it('accepts public https callbacks only', () => {
    expect(validateCallbackUrl('https://hooks.example.com/aic', false)).toEqual({ ok: true, url: 'https://hooks.example.com/aic' });
    expect(validateCallbackUrl('http://hooks.example.com/aic', false).ok).toBe(false);
    expect(validateCallbackUrl('https://localhost/x', false).ok).toBe(false);
    expect(validateCallbackUrl('https://10.0.0.5/x', false).ok).toBe(false);
    expect(validateCallbackUrl('https://[::1]/x', false).ok).toBe(false);
    expect(validateCallbackUrl('https://user:pw@hooks.example.com', false).ok).toBe(false);
    expect(isPrivateAddress('172.20.1.1')).toBe(true);
    expect(isPrivateAddress('8.8.8.8')).toBe(false);
  });
  it('signs callbacks so the receiver can verify them', () => {
    const s = orgCallbackSecret('org-1');
    expect(s).toMatch(/^whsec_[0-9a-f]{40}$/);
    expect(orgCallbackSecret('org-2')).not.toBe(s);
    const sig = signCallback(s, '{"a":1}', 1700000000);
    expect(verifyCallback(s, '{"a":1}', 1700000000, sig)).toBe(true);
    expect(verifyCallback(s, '{"a":2}', 1700000000, sig)).toBe(false);
  });
  it('bounds the review window and expires pending reviews', () => {
    const now = new Date('2026-10-05T00:00:00Z');
    expect(reviewDeadline(undefined, now).toISOString()).toBe('2026-10-08T00:00:00.000Z');
    expect(reviewDeadline(0, now).getTime() - now.getTime()).toBe(3_600_000);
    expect(isExpired('pending', '2026-10-04T00:00:00Z', now)).toBe(true);
    expect(isExpired('approved', '2026-10-04T00:00:00Z', now)).toBe(false);
  });
  it('tells the system the final outcome, and only after a decision', () => {
    const base = { id: 'd', externalRef: 'X', outcome: { decision: 'decline' }, finalOutcome: { decision: 'approve' }, reviewedAt: null, reviewNote: null, reviewDueAt: null };
    expect(publicReview({ ...base, reviewStatus: 'pending' }).final_outcome).toBeNull();
    expect(publicReview({ ...base, reviewStatus: 'approved' }).final_outcome).toEqual({ decision: 'decline' });
    expect(publicReview({ ...base, reviewStatus: 'overridden' }).final_outcome).toEqual({ decision: 'approve' });
  });
});
