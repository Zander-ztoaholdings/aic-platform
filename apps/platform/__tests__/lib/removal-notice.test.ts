// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { removalEmail, removalReference } from '@/lib/removal-notice';

describe('removal notice', () => {
  const actor = { name: 'Zander Wilken', email: 'zander@aic.test', role: 'AIC administrator' };
  it('names who decided, the reason, and how to challenge it', () => {
    const e = removalEmail({ kind: 'organisation', subjectName: 'Acme (Pty) Ltd', recipient: { email: 'cfo@acme.test', name: 'Thandi Mokoena' }, actor, reason: 'Duplicate registration', reference: 'AIC-ORG-1234ABCD', when: new Date('2026-10-07T10:00:00Z') });
    expect(e.to).toBe('cfo@acme.test');
    expect(e.subject).toBe('Acme (Pty) Ltd has been removed from AIC (AIC-ORG-1234ABCD)');
    expect(e.replyTo).toBe('zander@aic.test');
    const body = e.paragraphs.join(' ');
    expect(body).toContain('Hello Thandi');
    expect(body).toContain('The reason recorded: Duplicate registration');
    expect(body).toContain('The person responsible for this decision is Zander Wilken, AIC administrator.');
    expect(body).toContain('until 6 November 2026');
    expect(e.action?.url).toBe('mailto:zander@aic.test?subject=Challenge%20to%20removal%20AIC-ORG-1234ABCD');
  });
  it('makes a short reference from the id', () => {
    expect(removalReference('account', '27975c38-bf10-4ab8-9035-9b6c04d93e06')).toBe('AIC-ACC-27975C38');
  });
});
