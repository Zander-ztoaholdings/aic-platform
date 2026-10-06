import { describe, it, expect } from 'vitest';
import { linkState, cleanLinkInput, linkEmail, canEmail, MAX_EMAILS_PER_LINK } from '@/lib/onboarding-links';

const now = new Date('2026-10-06T10:00:00Z');
const open = { contactEmail: 'lerato@karoo.example', revokedAt: null, expiresAt: new Date('2026-10-20T10:00:00Z'), uses: 0, maxUses: 1 };

describe('onboarding links', () => {
  it('knows where a link stands', () => {
    expect(linkState(open, now)).toBe('open');
    expect(linkState({ ...open, uses: 1 }, now)).toBe('used');
    expect(linkState({ ...open, expiresAt: new Date('2026-10-01') }, now)).toBe('expired');
    expect(linkState({ ...open, revokedAt: now }, now)).toBe('revoked');
  });
  it('checks what staff typed', () => {
    expect(cleanLinkInput({ contactEmail: 'not an email' })).toHaveProperty('error');
    expect(cleanLinkInput({ days: 120 })).toHaveProperty('error');
    expect(cleanLinkInput({ contactEmail: 'Lerato@Karoo.example', days: '14' })).toMatchObject({ value: { contactEmail: 'lerato@karoo.example', days: 14, maxUses: 1 } });
  });
});

describe('the onboarding email', () => {
  const l = { token: 'tok_abcdefghijklmnopqrstuv', orgName: 'Karoo Mutual (Demo)', contactName: 'Lerato Mokoena', expiresAt: new Date('2026-10-20T10:00:00Z') };
  it('says who sent it, how to check it, and where the button goes', () => {
    const m = linkEmail(l, { name: 'Zander Wilken', email: 'zander@aiccertified.cloud' }, 'https://app.aiccertified.cloud');
    expect(m.subject).toBe("Start Karoo Mutual (Demo)'s onboarding with AIC");
    expect(m.paragraphs[0]).toBe('Hello Lerato,');
    expect(m.paragraphs[1]).toMatch(/^Zander Wilken at AI Integrity Certification \(AIC\) has set up onboarding for Karoo Mutual \(Demo\)/);
    expect(m.paragraphs[2]).toMatch(/opens app\.aiccertified\.cloud\. You can reply to this email to reach Zander directly\. AIC never asks for a password/);
    expect(m.action.url).toBe('https://app.aiccertified.cloud/join/tok_abcdefghijklmnopqrstuv');
    expect(m.footnote).toMatch(/works until 20 October 2026/);
  });
  it('does not promise a reply when there is no address to reply to', () => {
    expect(linkEmail(l, { name: null, email: null }, 'https://app.aiccertified.cloud').paragraphs[2]).not.toMatch(/reply/);
  });
});

describe('when a link may be emailed', () => {
  it('needs an address and an open link', () => {
    expect(canEmail({ ...open, contactEmail: null }, [], now)).toMatch(/email address/);
    expect(canEmail({ ...open, uses: 1 }, [], now)).toMatch(/still open/);
    expect(canEmail(open, [], now)).toBeNull();
  });
  it('waits ten minutes between sends and stops after a few', () => {
    expect(canEmail(open, [{ sentAt: new Date(now.getTime() - 5 * 60_000), accepted: true }], now)).toMatch(/ten minutes/);
    expect(canEmail(open, [{ sentAt: new Date(now.getTime() - 5 * 60_000), accepted: false }], now)).toBeNull();
    const many = Array.from({ length: MAX_EMAILS_PER_LINK }, (_, i) => ({ sentAt: new Date(now.getTime() - (i + 1) * 3_600_000), accepted: true }));
    expect(canEmail(open, many, now)).toMatch(/already been emailed/);
  });
});
