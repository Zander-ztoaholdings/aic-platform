import { describe, it, expect } from 'vitest';
import { progressFrom, SETUP_STEPS } from '@/lib/onboarding';

describe('set-up guide progress', () => {
  it('hides admin-only steps from members', () => {
    const member = progressFrom({}, false);
    expect(member.steps.some((s) => s.adminOnly)).toBe(false);
    expect(progressFrom({}, true).total).toBe(SETUP_STEPS.length);
  });
  it('the next step is the first not done, passing over skipped ones until only they are left', () => {
    expect(progressFrom({ accountable: true }, true).next).toBe('system');
    expect(progressFrom({ accountable: true }, true, ['system']).next).toBe('frameworks');
    const allButSkipped = Object.fromEntries(SETUP_STEPS.filter((s) => s.id !== 'aware').map((s) => [s.id, true]));
    expect(progressFrom(allButSkipped, true, ['aware']).next).toBe('aware');
  });
  it('counts what is done and says when everything is', () => {
    const all = Object.fromEntries(SETUP_STEPS.map((s) => [s.id, true]));
    expect(progressFrom(all, true)).toMatchObject({ done: SETUP_STEPS.length, next: null });
  });
  it('agents are not a set-up step: they do not bear on certification', () => {
    expect(SETUP_STEPS.some((s) => s.href.startsWith('/agents'))).toBe(false);
  });
});
