import { describe, it, expect } from 'vitest';
import { deriveSignals, suggestions, covers, liveStatus, suggestedDescription, templatesForControls, emptyObservations, type RiskObservations, type RegisterRisk } from '@/lib/registers/risk-signals';
import { RISK_LIBRARY, LIBRARY_BY_KEY } from '@/lib/registers/risk-library';
import { COMMON_BY_KEY } from '@/lib/common-controls';

const obs = (o: Partial<RiskObservations>): RiskObservations => ({ ...emptyObservations(), ...o });
const risk = (o: Partial<RegisterRisk>): RegisterRisk => ({ id: 'r1', title: 'A risk', status: 'open', controls: [], libraryKey: null, signalKeys: [], ...o });

describe('risk library', () => {
  it('has about 25 templates with unique keys, real controls and sensible scores', () => {
    expect(RISK_LIBRARY.length).toBeGreaterThanOrEqual(25);
    expect(new Set(RISK_LIBRARY.map((t) => t.key)).size).toBe(RISK_LIBRARY.length);
    for (const t of RISK_LIBRARY) {
      for (const c of [...t.controls, ...(t.raisedBy ?? [])]) expect(COMMON_BY_KEY[c], `${t.key}: ${c}`).toBeDefined();
      for (const c of t.raisedBy ?? []) expect(t.controls, `${t.key} raisedBy ${c}`).toContain(c);
      expect(t.likelihood).toBeGreaterThanOrEqual(1); expect(t.likelihood).toBeLessThanOrEqual(5);
      expect(t.impact).toBeGreaterThanOrEqual(1); expect(t.impact).toBeLessThanOrEqual(5);
      expect(t.title).not.toMatch(/→|·/);
    }
  });
});

describe('deriveSignals', () => {
  it('returns nothing when nothing is wrong', () => {
    expect(deriveSignals(emptyObservations())).toEqual([]);
  });

  it('groups failing checks by check and maps them through their controls', () => {
    const s = deriveSignals(obs({ failingChecks: [
      { checkKey: 'm365.mfa_enforced', title: 'MFA is enforced', subject: 'Tenant', summary: 'Security defaults are off.', controls: ['iam.mfa'] },
      { checkKey: 'm365.mfa_enforced', title: 'MFA is enforced', subject: 'Other', summary: 'No policy.', controls: ['iam.mfa'] },
    ] }));
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ id: 'check:m365.mfa_enforced', kind: 'check', libraryKeys: ['no_mfa'], controls: ['iam.mfa'] });
    expect(s[0].evidence).toBe('Security defaults are off. No policy.');
    expect(templatesForControls(['ops.endpoint', 'ops.encryption'])).toEqual(expect.arrayContaining(['lost_device', 'cloud_data_exposure']));
  });

  it('raises undeclared systems, supplier flags, leavers, findings, access reviews, retiring models, spend and quiet systems', () => {
    const s = deriveSignals(obs({
      undeclared: [{ name: 'Fraud bot', decisions: 12 }, { name: 'Drafting tool', provider: 'openai' }],
      suppliers: [{ name: 'Anthropic', flags: ['Holds personal information with no written data processing agreement (POPIA s21).', 'Personal information leaves South Africa without an agreement that protects it (POPIA s72).'] }],
      leavers: { status: 'fail', label: '1 of 2 leavers still have access: Johan Botha' },
      overdueFindings: [{ title: 'Bias testing', dueAt: '2026-09-01T00:00:00Z' }],
      accessReview: { status: 'pass', label: 'ok' },
      overdueAccessReviews: [{ name: 'Access review, August 2026', dueAt: '2026-09-10T00:00:00Z' }],
      retiringModels: [{ model: 'claude-sonnet-4-5', provider: 'anthropic', status: 'deprecated', on: '2026-11-30', daysLeft: 55 }],
      spend: { monthToDate: 300, projected: 2300, budget: 2000 },
      quietSystems: [{ name: 'Loan pre-screening', decisions: 400, days: 90 }],
    }));
    const kinds = s.map((x) => x.id);
    expect(kinds).toEqual([
      'undeclared_ai:systems', 'supplier:Anthropic|agreement', 'supplier:Anthropic|abroad', 'leavers:access', 'findings:overdue',
      'access_review:overdue', 'model_retiring:claude-sonnet-4-5', 'spend:budget', 'quiet_system:Loan pre-screening',
    ]);
    expect(s[0].evidence).toBe('Fraud bot logged 12 decisions; Drafting tool appears in openai usage, and are not in the AI system inventory.');
    expect(s[1].libraryKeys).toEqual(['supplier_no_agreement', 'pi_cross_border']);
    expect(s[2].libraryKeys).toEqual(['pi_cross_border']);
    expect(s[6].evidence).toBe('claude-sonnet-4-5 is still in use and will be retired on 30 November 2026, in 55 days.');
    expect(s[7].evidence).toBe('At the current rate the month ends near $2300.00, against a budget of $2000.00.');
    // Every signal points at templates that say they are evidenced by that kind of signal.
    for (const x of s) for (const k of x.libraryKeys) expect(LIBRARY_BY_KEY[k].signals, `${x.id} -> ${k}`).toContain(x.kind);
  });

  it('only flags spend when over or heading over budget, and leavers only when failing', () => {
    expect(deriveSignals(obs({ spend: { monthToDate: 100, projected: 1500, budget: 2000 } }))).toEqual([]);
    expect(deriveSignals(obs({ spend: { monthToDate: 2100, projected: 2400, budget: 2000 } }))[0].title).toBe("AI spend is over this month's budget");
    expect(deriveSignals(obs({ leavers: { status: 'pass', label: 'All good' } }))).toEqual([]);
  });
});

describe('suggestions and coverage', () => {
  const signals = deriveSignals(obs({
    failingChecks: [
      { checkKey: 'm365.mfa_enforced', title: 'MFA', subject: 't', summary: 'Off.', controls: ['iam.mfa'] },
      { checkKey: 'ai.models_declared', title: 'Models declared', subject: 'openai', summary: 'gpt-4.1 not linked.', controls: ['ai.inventory'] },
    ],
    undeclared: [{ name: 'Fraud bot', decisions: 3 }],
    spend: { monthToDate: 2100, projected: null, budget: 2000 },
  }));

  it('a failing check is covered by a risk relying on its control; others by library key or signal key', () => {
    const mfa = signals.find((s) => s.id === 'check:m365.mfa_enforced')!;
    expect(covers(risk({ controls: ['iam.mfa'] }), mfa)).toBe(true);
    expect(covers(risk({ controls: ['iam.mfa'], status: 'closed' }), mfa)).toBe(false);
    const spend = signals.find((s) => s.kind === 'spend')!;
    expect(covers(risk({ controls: ['ai.monitoring'] }), spend)).toBe(false);
    expect(covers(risk({ libraryKey: 'ai_spend_overrun' }), spend)).toBe(true);
    expect(covers(risk({ signalKeys: ['spend:budget'] }), spend)).toBe(true);
  });

  it('groups uncovered signals by template, highest score first, and honours dismissals', () => {
    const s = suggestions(signals, [risk({ controls: ['iam.mfa'] })], []);
    expect(s.map((x) => x.libraryKey)).toEqual(['shadow_ai', 'ai_spend_overrun']);
    expect(s[0].signals.map((x) => x.id)).toEqual(['check:ai.models_declared', 'undeclared_ai:systems']);
    const after = suggestions(signals, [risk({ controls: ['iam.mfa'] })], [{ signalKey: 'check', subject: 'ai.models_declared' }]);
    expect(after[0].signals.map((x) => x.id)).toEqual(['undeclared_ai:systems']);
    const none = suggestions(signals, [risk({ controls: ['iam.mfa'] })], [{ signalKey: 'check', subject: 'ai.models_declared' }, { signalKey: 'undeclared_ai', subject: 'systems' }, { signalKey: 'spend', subject: 'budget' }]);
    expect(none).toEqual([]);
  });

  it('writes the evidence into a suggested risk', () => {
    const d = suggestedDescription('ai_spend_overrun', signals.filter((x) => x.kind === 'spend'), '2026-10-06T08:00:00Z');
    expect(d).toContain(LIBRARY_BY_KEY.ai_spend_overrun.description);
    expect(d).toContain('AIC noticed on 6 October 2026:\n- $2100.00 spent so far this month against a budget of $2000.00.');
  });
});

describe('liveStatus', () => {
  const signals = deriveSignals(obs({
    failingChecks: [{ checkKey: 'm365.mfa_enforced', title: 'MFA', subject: 't', summary: 'Off.', controls: ['iam.mfa'] }],
    leavers: { status: 'fail', label: '1 of 2 leavers still have access: Johan Botha' },
  }));
  const title = (k: string) => COMMON_BY_KEY[k]?.title ?? k;

  it('says a risk is getting worse when a linked control fails, without counting its check twice', () => {
    const l = liveStatus(risk({ controls: ['iam.mfa', 'ops.awareness_training'] }), { 'iam.mfa': 'gap', 'ops.awareness_training': 'evidenced' }, signals, title);
    expect(l.trend).toBe('worse');
    expect(l.failingControls).toEqual(['iam.mfa']);
    expect(l.signals).toEqual([]);
    expect(l.sentence).toBe('Evidence says this is getting worse: a control it relies on is failing: Multi-factor sign-in.');
  });

  it('counts a linked signal that is not a control', () => {
    const l = liveStatus(risk({ controls: ['iam.leavers'], libraryKey: 'leaver_access' }), { 'iam.leavers': 'partial' }, signals, title);
    expect(l.trend).toBe('worse');
    expect(l.signals.map((s) => s.id)).toEqual(['leavers:access']);
  });

  it('is supported when every control is evidenced, and unverified otherwise', () => {
    expect(liveStatus(risk({ controls: ['iam.mfa'] }), { 'iam.mfa': 'evidenced' }, [], title).trend).toBe('supported');
    expect(liveStatus(risk({ controls: ['iam.mfa'] }), {}, [], title).trend).toBe('unverified');
    expect(liveStatus(risk({ controls: [] }), {}, [], title).sentence).toMatch(/No controls are linked/);
    expect(liveStatus(risk({ controls: ['iam.mfa'], status: 'closed' }), { 'iam.mfa': 'gap' }, signals, title).trend).toBe('unverified');
  });
});

describe('templatesForControls', () => {
  it('lets the main control of a check choose the template first', () => {
    expect(templatesForControls(['ops.endpoint', 'ops.encryption'])[0]).toBe('lost_device');
    expect(templatesForControls(['ops.encryption', 'ops.endpoint'])[0]).toBe('cloud_data_exposure');
    expect(templatesForControls(['priv.dpo'])).toEqual([]);
  });
});
