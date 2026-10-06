/**
 * Connector health, for AIC staff: from every recorded run of every
 * connector (lib/connectors/runs), which have worked against real client
 * accounts, which are failing, and which run but cannot answer most of
 * their checks. Pure: the route reads connector_runs and passes the rows in.
 */

export type HealthRun = {
  orgId: string;
  connector: string;
  outcome: string; // 'ok' | 'error' | 'disconnected'
  checks: number;
  unknownChecks: number;
  error: string | null;
  demo?: boolean;
  ranAt: Date | string;
};

export type HealthCatalogEntry = { key: string; name: string; category: string };

export type HealthState = 'not_used' | 'working' | 'failing' | 'partly_reading';

export type ConnectorHealth = {
  key: string;
  name: string;
  category: string;
  /** Distinct organisations with any run of this connector. */
  organisations: number;
  lastOk: string | null;
  lastError: { message: string; at: string } | null;
  okRuns: number;
  errorRuns: number;
  /** Share of checks answered "unknown" over successful runs in the last 30 days; null when there were none. */
  unknownShare: number | null;
  state: HealthState;
  /** At least one successful run, in any organisation, that answered most of its checks. */
  liveVerified: boolean;
};

/** A run that read the account and answered at least half of its checks. */
export const PARTLY_READING_AT = 0.5;
const WINDOW_MS = 30 * 86_400_000;

const time = (d: Date | string) => (d instanceof Date ? d : new Date(d)).getTime();
const iso = (d: Date | string) => (d instanceof Date ? d : new Date(d)).toISOString();

export function runAnswered(r: Pick<HealthRun, 'outcome' | 'checks' | 'unknownChecks'>): boolean {
  return r.outcome === 'ok' && r.checks > 0 && r.unknownChecks / r.checks < PARTLY_READING_AT;
}

export function connectorHealth(runs: HealthRun[], catalog: HealthCatalogEntry[], now: Date = new Date()): ConnectorHealth[] {
  const byConnector = new Map<string, HealthRun[]>();
  for (const r of runs) {
    if (r.demo) continue;
    const list = byConnector.get(r.connector);
    if (list) list.push(r);
    else byConnector.set(r.connector, [r]);
  }
  const since = now.getTime() - WINDOW_MS;

  return catalog.map((c) => {
    const list = (byConnector.get(c.key) ?? []).slice().sort((a, b) => time(a.ranAt) - time(b.ranAt));
    const ok = list.filter((r) => r.outcome === 'ok');
    const bad = list.filter((r) => r.outcome !== 'ok');
    const lastOkRun = ok.at(-1);
    const lastBadRun = bad.at(-1);

    const recent = ok.filter((r) => time(r.ranAt) >= since);
    const checks = recent.reduce((n, r) => n + r.checks, 0);
    const unknown = recent.reduce((n, r) => n + r.unknownChecks, 0);
    const unknownShare = checks > 0 ? unknown / checks : null;

    // Each organisation's most recent run says whether it works there now.
    const latestByOrg = new Map<string, HealthRun>();
    for (const r of list) latestByOrg.set(r.orgId, r);
    const failingSomewhere = [...latestByOrg.values()].some((r) => r.outcome === 'error');

    let state: HealthState;
    if (list.length === 0) state = 'not_used';
    else if (ok.length === 0 || failingSomewhere) state = 'failing';
    else if (unknownShare !== null && unknownShare >= PARTLY_READING_AT) state = 'partly_reading';
    else state = 'working';

    return {
      key: c.key,
      name: c.name,
      category: c.category,
      organisations: latestByOrg.size,
      lastOk: lastOkRun ? iso(lastOkRun.ranAt) : null,
      lastError: lastBadRun ? { message: lastBadRun.error ?? (lastBadRun.outcome === 'disconnected' ? 'Access was withdrawn.' : 'Failed without a message.'), at: iso(lastBadRun.ranAt) } : null,
      okRuns: ok.length,
      errorRuns: bad.length,
      unknownShare,
      state,
      liveVerified: ok.some(runAnswered),
    };
  });
}

/** Keys of connectors that have read a real account with most of their checks answered. */
export function provenConnectors(runs: HealthRun[]): string[] {
  return [...new Set(runs.filter((r) => !r.demo && runAnswered(r)).map((r) => r.connector))].sort();
}
