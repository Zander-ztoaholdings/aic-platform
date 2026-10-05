import { describe, it, expect } from 'vitest';
import { BUILDERS, missingAnswers, cleanAnswers, hasPlaceholder, type BuilderContext } from '@/lib/policy-builder';
import { POLICY_TEMPLATES } from '@/lib/policy-templates';
import { CLAIMS } from '@/lib/says-vs-does';

const ctx: BuilderContext = {
  orgName: 'Highveld Credit (Pty) Ltd (Demo)',
  people: [{ name: 'Naledi Khumalo', jobTitle: 'Chief Operating Officer' }, { name: 'Pieter van Wyk', jobTitle: 'Head of Credit' }, { name: 'Sipho Dlamini', jobTitle: 'Head of IT' }],
  accountable: { name: 'Naledi Khumalo', jobTitle: 'Chief Operating Officer' },
  connected: ['GitHub', 'Microsoft 365', 'OpenAI'],
  contactEmail: 'security@highveld.demo',
};

describe('policy builder', () => {
  it('has a builder for every template, and its monitored promises exist', () => {
    for (const t of POLICY_TEMPLATES) expect(BUILDERS[t.key], t.key).toBeDefined();
    const ids = new Set(CLAIMS.map((c) => c.id));
    for (const b of Object.values(BUILDERS)) for (const m of b.monitored) expect(ids.has(m), m).toBe(true);
  });

  it('pre-fills from the record and writes a policy with no blanks', () => {
    for (const [key, b] of Object.entries(BUILDERS)) {
      const a = b.defaults(ctx);
      if (key === 'information-security') a.vault = '1Password';
      expect(missingAnswers(b, a), key).toEqual([]);
      const text = b.render(a, ctx);
      expect(hasPlaceholder(text), key).toBe(false);
      expect(text, key).not.toMatch(/undefined|null/);
    }
  });

  it('uses the record: owner, tools, security lead', () => {
    const ai = BUILDERS['ai-acceptable-use'];
    const a = ai.defaults(ctx);
    expect(a.owner).toBe('Naledi Khumalo (Chief Operating Officer)');
    expect(a.tools).toEqual(['OpenAI API (for our own systems)', 'Microsoft 365 Copilot', 'GitHub Copilot']);
    expect(ai.render(a, ctx)).toContain('- GitHub Copilot');
    expect(BUILDERS['information-security'].defaults(ctx).owner).toBe('Sipho Dlamini (Head of IT)');
  });

  it('answers change the wording', () => {
    const b = BUILDERS['human-oversight'];
    const a = { ...b.defaults(ctx), when: 'request', days: '5' };
    const t = b.render(a, ctx);
    expect(t).toContain('whenever the person affected asks');
    expect(t).toContain('within 5 working days');
    const sec = BUILDERS['information-security'];
    expect(sec.render({ ...sec.defaults(ctx), vault: 'Bitwarden', code: 'no' }, ctx)).not.toContain('code repositories');
  });

  it('cleans answers and asks for what is missing', () => {
    const b = BUILDERS['information-security'];
    const a = cleanAnswers(b, { owner: ' Sipho ', access: '99', vault: 'Keeper', extra: 'x' });
    expect(a).toEqual({ owner: 'Sipho', vault: 'Keeper' });
    expect(missingAnswers(b, a).length).toBeGreaterThan(0);
  });

  it('spots placeholders but not markdown links', () => {
    expect(hasPlaceholder('kept by [role]')).toBe(true);
    expect(hasPlaceholder('see [the guide](https://x)')).toBe(false);
  });
});
