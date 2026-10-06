import { getSystemDb, connectorRuns } from '@aic/db';
import type { CheckResult } from '../integrations/catalog';

export type RunOutcome = 'ok' | 'error' | 'disconnected';

/**
 * Note one run of a connector against an organisation's account, so AIC
 * staff can see which connectors have worked against real systems. Best
 * effort: a failure here (including the table not existing yet, before
 * migration 017) is logged and never interrupts the sync or the connect.
 */
export async function recordConnectorRun(
  orgId: string,
  connector: string,
  outcome: RunOutcome,
  results: CheckResult[] | null,
  error: string | null,
  demo: boolean,
): Promise<void> {
  try {
    const checks = results?.length ?? 0;
    const unknownChecks = results ? results.filter((r) => r.status === 'unknown').length : 0;
    await getSystemDb().insert(connectorRuns).values({
      orgId,
      connector: connector.slice(0, 40),
      outcome,
      checks,
      unknownChecks,
      error: error ? error.slice(0, 2000) : null,
      demo,
    });
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    if (/connector_runs/.test(msg) && /does not exist/.test(msg)) {
      console.warn('[CONNECTORS] connector_runs is missing (migration 017 not applied); run not recorded');
    } else {
      console.error(`[CONNECTORS] could not record a ${connector} run:`, msg);
    }
  }
}
