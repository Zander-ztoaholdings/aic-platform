import { describe, it, expect } from 'vitest';
import { evaluateClaims, summarise, CLAIMS } from '@/lib/says-vs-does';
import { CHECK_BY_KEY } from '@/lib/integrations/catalog';

const policy = (templateKey: string, publishedVersion = 1) => ({ id: 'p-' + templateKey, templateKey, title: templateKey, publishedVersion, accepted: 3, members: 5 });

describe('says versus does', () => {
  it('every claim refers only to checks that exist', () => {
    for (const c of CLAIMS) for (const k of c.checks) expect(CHECK_BY_KEY[k], `${c.id} -> ${k}`).toBeDefined();
  });

  it('ignores draft policies', () => {
    expect(evaluateClaims([policy('information-security', 0)], [], {})).toEqual([]);
  });

  it('a failing check contradicts the promise and names the subject', () => {
    const r = evaluateClaims([policy('information-security')], [
      { checkKey: 'm365.mfa_enforced', subject: 'Karoo', status: 'fail', summary: 'Nothing requires MFA.' },
    ], {});
    const mfa = r.find((x) => x.claimId === 'infosec.second_factor')!;
    expect(mfa.verdict).toBe('contradicted');
    expect(mfa.does[0].text).toContain('Karoo');
    expect(mfa.acceptedBy).toBe('3 of 5');
    expect(r[0].verdict).toBe('contradicted');
  });

  it('pass plus fail is partly true; no data is not observed', () => {
    const r = evaluateClaims([policy('information-security')], [
      { checkKey: 'github.branch_protected', subject: 'a/b', status: 'pass', summary: 'ok' },
      { checkKey: 'github.merged_with_review', subject: 'a/b', status: 'fail', summary: 'PR #4 merged unreviewed' },
    ], {});
    expect(r.find((x) => x.claimId === 'infosec.code_review')!.verdict).toBe('partly');
    expect(r.find((x) => x.claimId === 'infosec.leavers')!.verdict).toBe('not_observed');
  });

  it('platform facts count as evidence', () => {
    const r = evaluateClaims([policy('human-oversight')], [], {
      accountable_person_named: { ok: true, detail: 'named' },
      overrides_recorded: { ok: false, detail: '300 decisions and none overridden' },
      production_systems_logging: { ok: null, detail: 'none in production' },
    });
    expect(r.find((x) => x.claimId === 'oversight.named_person')!.verdict).toBe('consistent');
    expect(r.find((x) => x.claimId === 'oversight.override_rate')!.verdict).toBe('contradicted');
    expect(r.find((x) => x.claimId === 'oversight.overrides_logged')!.verdict).toBe('not_observed');
    expect(summarise(r).contradicted).toBeGreaterThanOrEqual(1);
  });
});
