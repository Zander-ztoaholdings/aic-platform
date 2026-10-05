import { describe, it, expect } from 'vitest';
import { parseQuestions, draftAnswer, toCsv } from '@/lib/questionnaire';
import type { OrgFacts } from '@/lib/org-facts';

const facts = (over: Partial<OrgFacts> = {}): OrgFacts => ({
  org: { id: 'o', name: 'Karoo', legalName: 'Karoo Lending (Pty) Ltd', division: 2, website: null },
  badge: { code: 'AWR-ABCD-EFGH', issuedAt: '2026-10-01T00:00:00Z', expiresAt: '2027-10-01T00:00:00Z', status: 'valid' },
  certificate: null,
  accountablePerson: { name: 'Thandi Mokoena', jobTitle: 'COO', since: '2026-09-01T00:00:00Z' },
  policies: [{ key: 'information-security', title: 'Information security policy', version: 2, publishedAt: null, accepted: 4, members: 5 }],
  connectors: [{ provider: 'Microsoft 365', label: null, lastChecked: '2026-10-05T00:00:00Z' }],
  checks: [{ key: 'm365.mfa_enforced', subject: 'Karoo', status: 'pass', summary: 'Security defaults on', observedAt: '2026-10-05T02:00:00Z' }],
  systems: [{ name: 'Claims triage', purpose: null, riskTier: 2, stage: 'PRODUCTION' }],
  decisions: { last90: 0, overrides: 0 },
  ...over,
});

describe('questionnaires', () => {
  it('parses numbered lists, CSV and tab-separated pastes', () => {
    expect(parseQuestions('Question\n1. Do you enforce MFA for all users?\n"Is data encrypted at rest, ""and"" in transit?",Yes\nQ3: Describe your incident process\tNotes\n\nok')).toEqual([
      'Do you enforce MFA for all users?', 'Is data encrypted at rest, "and" in transit?', 'Describe your incident process',
    ]);
  });

  it('drafts from policy and observed checks, citing version and acceptance', () => {
    const d = draftAnswer('Do you enforce multi-factor authentication?', facts());
    expect(d.topic).toBe('mfa');
    expect(d.status).toBe('draft');
    expect(d.draft).toContain('version 2, accepted by 4 of 5');
    expect(d.draft).toContain('observed by AIC');
  });

  it('flags a contradiction instead of claiming it', () => {
    const d = draftAnswer('Is MFA required?', facts({ checks: [{ key: 'm365.mfa_enforced', subject: 'Karoo', status: 'fail', summary: 'Nothing requires MFA', observedAt: null }] }));
    expect(d.status).toBe('needs_input');
    expect(d.draft).toContain('CHECK BEFORE SENDING');
  });

  it('never invents what AIC cannot see', () => {
    expect(draftAnswer('Is customer data encrypted at rest?', facts()).status).toBe('needs_input');
    expect(draftAnswer('What colour is your logo?', facts()).topic).toBe('other');
  });

  it('exports only approved answers', () => {
    const csv = toCsv([{ question: 'Q1', answer: 'A1', status: 'approved', approvedBy: 'T', approvedAt: '2026-10-05T00:00:00Z' }, { question: 'Q2', answer: 'draft', status: 'draft', approvedBy: null, approvedAt: null }]);
    expect(csv).toContain('"Q1","A1","Approved","T","2026-10-05"');
    expect(csv).toContain('"Q2","","Not yet approved"');
  });
});
