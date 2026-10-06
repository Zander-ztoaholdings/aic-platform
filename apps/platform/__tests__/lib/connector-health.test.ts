import { describe, it, expect } from 'vitest';
import { connectorHealth, provenConnectors, type HealthRun } from '@/lib/connectors/health';

const now = new Date('2026-10-20T10:00:00Z');
const day = (n: number) => new Date(now.getTime() - n * 86_400_000);
const catalog = [
  { key: 'okta', name: 'Okta', category: 'identity' },
  { key: 'aws', name: 'Amazon Web Services', category: 'cloud' },
];
const run = (o: Partial<HealthRun> & Pick<HealthRun, 'outcome'>): HealthRun => ({
  orgId: 'org-a', connector: 'okta', checks: 4, unknownChecks: 0, error: null, ranAt: day(1), ...o,
});
const of = (runs: HealthRun[], key = 'okta') => connectorHealth(runs, catalog, now).find((h) => h.key === key)!;

describe('connectorHealth', () => {
  it('returns every catalogue entry, unused ones as not used', () => {
    const h = connectorHealth([], catalog, now);
    expect(h.map((x) => x.key)).toEqual(['okta', 'aws']);
    expect(h[0]).toMatchObject({ state: 'not_used', organisations: 0, okRuns: 0, errorRuns: 0, lastOk: null, lastError: null, unknownShare: null, liveVerified: false, name: 'Okta', category: 'identity' });
  });

  it('a connector that read an account with its checks answered is working and proven', () => {
    const h = of([run({ outcome: 'ok', checks: 4, unknownChecks: 1, ranAt: day(2) })]);
    expect(h.state).toBe('working');
    expect(h.liveVerified).toBe(true);
    expect(h.unknownShare).toBe(0.25);
    expect(h.lastOk).toBe(day(2).toISOString());
  });

  it('counts distinct organisations and ok and error runs', () => {
    const h = of([
      run({ outcome: 'ok', orgId: 'a', ranAt: day(5) }),
      run({ outcome: 'ok', orgId: 'a', ranAt: day(4) }),
      run({ outcome: 'error', orgId: 'b', error: 'boom', ranAt: day(3) }),
      run({ outcome: 'ok', orgId: 'b', ranAt: day(2) }),
    ]);
    expect(h.organisations).toBe(2);
    expect(h.okRuns).toBe(3);
    expect(h.errorRuns).toBe(1);
    expect(h.lastError).toEqual({ message: 'boom', at: day(3).toISOString() });
    expect(h.state).toBe('working');
  });

  it('is failing when any organisation’s latest run errored', () => {
    const h = of([
      run({ outcome: 'ok', orgId: 'a', ranAt: day(1) }),
      run({ outcome: 'ok', orgId: 'b', ranAt: day(3) }),
      run({ outcome: 'error', orgId: 'b', error: '500 from Okta', ranAt: day(2) }),
    ]);
    expect(h.state).toBe('failing');
    expect(h.liveVerified).toBe(true);
  });

  it('is failing when it has never succeeded', () => {
    const h = of([run({ outcome: 'disconnected', error: null })]);
    expect(h.state).toBe('failing');
    expect(h.lastError?.message).toBe('Access was withdrawn.');
    expect(h.liveVerified).toBe(false);
  });

  it('an organisation that withdrew access does not make a working connector failing', () => {
    const h = of([
      run({ outcome: 'ok', orgId: 'a' }),
      run({ outcome: 'ok', orgId: 'b', ranAt: day(3) }),
      run({ outcome: 'disconnected', orgId: 'b', error: 'revoked', ranAt: day(2) }),
    ]);
    expect(h.state).toBe('working');
  });

  it('is partly reading when at least half the recent checks came back unknown', () => {
    const h = of([run({ outcome: 'ok', checks: 4, unknownChecks: 2 })]);
    expect(h.state).toBe('partly_reading');
    expect(h.unknownShare).toBe(0.5);
    expect(h.liveVerified).toBe(false);
  });

  it('unknown share only counts ok runs in the last 30 days', () => {
    const h = of([
      run({ outcome: 'ok', checks: 4, unknownChecks: 0, ranAt: day(40) }),
      run({ outcome: 'ok', checks: 4, unknownChecks: 3, ranAt: day(1) }),
    ]);
    expect(h.unknownShare).toBe(0.75);
    expect(h.state).toBe('partly_reading');
    // The older run answered most of its checks, so it is still proven.
    expect(h.liveVerified).toBe(true);
  });

  it('no recent ok runs leaves the share empty but the state working', () => {
    const h = of([run({ outcome: 'ok', ranAt: day(60) })]);
    expect(h.unknownShare).toBeNull();
    expect(h.state).toBe('working');
  });

  it('an ok run with no checks does not prove a connector', () => {
    expect(of([run({ outcome: 'ok', checks: 0 })]).liveVerified).toBe(false);
  });

  it('ignores demo runs and runs of connectors not in the catalogue', () => {
    const h = connectorHealth([run({ outcome: 'ok', demo: true }), run({ outcome: 'ok', connector: 'other' })], catalog, now);
    expect(h.find((x) => x.key === 'okta')!.state).toBe('not_used');
    expect(h).toHaveLength(2);
  });

  it('accepts ISO strings for ranAt', () => {
    expect(of([run({ outcome: 'ok', ranAt: day(1).toISOString() })]).lastOk).toBe(day(1).toISOString());
  });
});

describe('provenConnectors', () => {
  it('lists each connector with an answered ok run once, ignoring demo and partly read runs', () => {
    expect(provenConnectors([
      run({ outcome: 'ok', connector: 'okta' }),
      run({ outcome: 'ok', connector: 'okta', orgId: 'b' }),
      run({ outcome: 'ok', connector: 'aws', checks: 2, unknownChecks: 1 }),
      run({ outcome: 'ok', connector: 'jamf', demo: true }),
      run({ outcome: 'error', connector: 'slack' }),
    ])).toEqual(['okta']);
  });
});
