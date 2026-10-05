import { NextResponse } from 'next/server';
import { getSystemDb, probeTenantIsolation, sql } from '@aic/db';
import { storageHealth } from '@aic/db/storage';
import { standardHealth } from '@/lib/standard';

/**
 * Public, and deliberately terse.
 *
 * This route is reachable without a session — a health check behind an auth
 * gate cannot do its job. That means it must not hand a stranger the contents
 * of internal error messages: a failed database connection error can carry the
 * connection string, and an engine error carries an internal hostname. Only the
 * standard check reports detail, because the URLs it tries are public by
 * construction (NEXT_PUBLIC_WEB_URL and aiccertified.cloud) and knowing which
 * one failed is the entire diagnostic value.
 *
 * Full errors still go to the container log.
 */

const ENGINE_URL = process.env.ENGINE_URL || 'http://localhost:8000';
const ENGINE_API_KEY = process.env.ENGINE_API_KEY || '';

interface ServiceCheck {
  status: 'ok' | 'error';
  latency_ms: number;
  detail?: string;
}

export async function GET() {
  const checks: Record<string, ServiceCheck> = {};

  // 1. Database check (Task M50: Institutional Health)
  const dbStart = Date.now();
  try {
    const db = getSystemDb();
    await db.execute(sql`SELECT 1`);
    checks.database = { status: 'ok', latency_ms: Date.now() - dbStart };
  } catch (err: unknown) {
    console.error('[HEALTH] database check failed:', err);
    checks.database = { status: 'error', latency_ms: Date.now() - dbStart };
  }

  // 2. Engine check
  const engineStart = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${ENGINE_URL}/`, {
      signal: controller.signal,
      headers: ENGINE_API_KEY ? { 'X-API-Key': ENGINE_API_KEY } : {},
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      checks.engine = {
        status: 'ok',
        latency_ms: Date.now() - engineStart,
        detail: data.status || 'Operational',
      };
    } else {
      checks.engine = { status: 'error', latency_ms: Date.now() - engineStart, detail: `HTTP ${res.status}` };
    }
  } catch (err: unknown) {
    console.error('[HEALTH] engine check failed:', err);
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    checks.engine = {
      status: 'error',
      latency_ms: Date.now() - engineStart,
      detail: isTimeout ? 'Timeout (5s)' : 'Unreachable',
    };
  }

  // 3. Schema drift. Drizzle selects the full column list from schema.ts, so a
  //    database missing a column the schema declares fails at query time on
  //    whichever route touches that table first — which is how a migration that
  //    was never applied announces itself: as an unrelated 500, hours later, on
  //    a page nobody connected to the deploy. This names it directly.
  const schemaStart = Date.now();
  try {
    const db = getSystemDb();
    const expected: [string, string][] = [
      ['audit_requirements', 'code'],            // 003
      ['audit_requirements', 'right_code'],      // 003
      ['organizations', 'division'],             // 003
      ['audit_documents', 'requirement_id'],     // 002
      ['audit_documents', 'verified_by'],        // 002
      ['issued_certifications', 'suspended_at'], // 002
      ['api_keys', 'key_lookup'],                // 012
      ['decision_records', 'review_status'],     // 014
      ['organizations', 'ai_monthly_budget_usd'],// 014
    ];
    const expectedTables = ['audit_findings', 'corrective_actions', 'integrations', 'integration_checks', 'org_policies', 'trust_pages', 'questionnaires', 'questionnaire_items']; // 002, 011, 013, 014

    const found = await db.execute(sql`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public'
    `);
    const have = new Set(
      (found.rows as { table_name: string; column_name: string }[])
        .map((r) => `${r.table_name}.${r.column_name}`)
    );
    const haveTables = new Set(
      (found.rows as { table_name: string }[]).map((r) => r.table_name)
    );

    const missing = [
      ...expected.filter(([t, c]) => !have.has(`${t}.${c}`)).map(([t, c]) => `${t}.${c}`),
      ...expectedTables.filter((t) => !haveTables.has(t)),
    ];

    checks.schema = missing.length
      ? {
          status: 'error',
          latency_ms: Date.now() - schemaStart,
          detail: `behind — missing ${missing.join(', ')} (apply the db/manual migrations up to 014)`,
        }
      : { status: 'ok', latency_ms: Date.now() - schemaStart, detail: 'up to date with 014' };
  } catch (err: unknown) {
    console.error('[HEALTH] schema check failed:', err);
    checks.schema = { status: 'error', latency_ms: Date.now() - schemaStart, detail: 'Could not read' };
  }

  // Row-level security is only enforced when the app connects as the
  // restricted role. Reported, so it cannot be silently off.
  const isoStart = Date.now();
  const iso = await probeTenantIsolation();
  checks.tenant_isolation = { status: iso.enforced ? 'ok' : 'error', latency_ms: Date.now() - isoStart, detail: iso.detail };
  if (!iso.enforced) console.error('[HEALTH] tenant isolation:', iso.detail);

  // Evidence storage. Uploads fail without it, so it is reported, not assumed.
  const stoStart = Date.now();
  const sto = await storageHealth();
  checks.evidence_storage = { status: sto.ok ? 'ok' : 'error', latency_ms: Date.now() - stoStart, detail: sto.detail };

  // 4. The published standard. Registration cannot generate a roadmap without
  //    it, so a signup failing for this reason should be visible here first
  //    rather than discovered by whoever is trying to register.
  const stdStart = Date.now();
  const std = await standardHealth();
  checks.standard = std.ok
    ? { status: 'ok', latency_ms: Date.now() - stdStart, detail: `v${std.version}` }
    : { status: 'error', latency_ms: Date.now() - stdStart, detail: std.detail };
  if (!std.ok) console.error('[HEALTH] standard check failed:', std.detail);

  const allOk = Object.values(checks).every(c => c.status === 'ok');
  // 503 only when the platform cannot serve anyone (no database, or tenant
  // pages failing to sign in). A stopped engine or an unreachable website is
  // "degraded" with 200, so an uptime monitor pages for outages, not for
  // every amber line; the body still lists each failing check.
  const down = checks.database?.status !== 'ok' || (process.env.TENANT_DATABASE_URL && checks.tenant_isolation?.status !== 'ok');

  return NextResponse.json({
    status: down ? 'down' : allOk ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  }, { status: down ? 503 : 200 });
}
