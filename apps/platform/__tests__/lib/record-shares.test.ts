// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { validateShare, maskEmail, signViewerPass, readViewerPass, shareState } from '@/lib/record-shares';

beforeAll(() => { process.env.NEXTAUTH_SECRET = 'test-secret-that-is-long-enough-for-hmac'; });
const NOW = new Date('2026-10-07T10:00:00Z');

describe('record shares', () => {
  it('accepts a named person, a past period and an expiry', () => {
    const r = validateShare({ recipientName: 'Naledi Khumalo', recipientEmail: 'Naledi@Auditor.co.za', fromDate: '2026-07-01', toDate: '2026-09-30', days: 14 }, NOW);
    expect('value' in r && r.value.recipientEmail).toBe('naledi@auditor.co.za');
  });
  it('refuses a period that ends in the future or runs backwards, and a long link', () => {
    expect('error' in validateShare({ recipientName: 'A B', recipientEmail: 'a@b.co', fromDate: '2026-10-01', toDate: '2026-10-09', days: 7 }, NOW)).toBe(true);
    expect('error' in validateShare({ recipientName: 'A B', recipientEmail: 'a@b.co', fromDate: '2026-10-05', toDate: '2026-10-01', days: 7 }, NOW)).toBe(true);
    expect('error' in validateShare({ recipientName: 'A B', recipientEmail: 'a@b.co', fromDate: '2026-10-01', toDate: '2026-10-05', days: 91 }, NOW)).toBe(true);
  });
  it('masks the address so it can be recognised but not learned', () => {
    expect(maskEmail('naledi@auditor.co.za')).toBe('n*****@auditor.co.za');
  });
  it('gives a pass that only opens its own share, for its own viewer, until it expires', () => {
    const pass = signViewerPass('share-1', 'Naledi@auditor.co.za', NOW.getTime());
    expect(readViewerPass(pass, 'share-1', NOW.getTime())).toBe('naledi@auditor.co.za');
    expect(readViewerPass(pass, 'share-2', NOW.getTime())).toBeNull();
    expect(readViewerPass(pass, 'share-1', NOW.getTime() + 31 * 60_000)).toBeNull();
    expect(readViewerPass(pass.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a')), 'share-1', NOW.getTime())).toBeNull();
  });
  it('knows open, expired and withdrawn', () => {
    expect(shareState({ expiresAt: '2026-10-08T00:00:00Z', revokedAt: null }, NOW)).toBe('open');
    expect(shareState({ expiresAt: '2026-10-06T00:00:00Z', revokedAt: null }, NOW)).toBe('expired');
    expect(shareState({ expiresAt: '2026-10-08T00:00:00Z', revokedAt: '2026-10-07T09:00:00Z' }, NOW)).toBe('withdrawn');
  });
});
