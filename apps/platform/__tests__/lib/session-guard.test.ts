import { describe, it, expect } from 'vitest';
import { shouldTag, pinUser, pinnedUser, announceSessionChange } from '@/lib/session-guard';

describe('session guard', () => {
  const o = 'https://app.aiccertified.cloud';
  it('tags only same-origin API calls, never the sign-in endpoints', () => {
    expect(shouldTag('/api/systems', o)).toBe(true);
    expect(shouldTag(`${o}/api/v1/admin/bulk`, o)).toBe(true);
    expect(shouldTag('/api/auth/session', o)).toBe(false);
    expect(shouldTag('/dashboard', o)).toBe(false);
    expect(shouldTag('https://api.anthropic.com/api/x', o)).toBe(false);
  });
  it('pins the first account seen, and lets go only on a deliberate change', () => {
    pinUser('a');
    pinUser('b');
    expect(pinnedUser()).toBe('a');
    announceSessionChange();
    expect(pinnedUser()).toBeNull();
    pinUser('b');
    expect(pinnedUser()).toBe('b');
  });
});
