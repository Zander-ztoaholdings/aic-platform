#!/usr/bin/env node
/**
 * Runs a single SQL statement (or semicolon-separated batch) against
 * DATABASE_URL and prints any result rows as a table.
 *
 * Companion to apply-sql.mjs: that script applies a whole migration file and
 * deliberately does not print output, because a migration isn't supposed to
 * have any. This one exists for the opposite case - a one-off SELECT (or a
 * small hand-picked batch of statements, e.g. one step out of a multi-step
 * manual migration) where you need to actually see what came back, not just
 * "applied successfully".
 *
 *   DATABASE_URL='postgres://...' node scripts/query.mjs "SELECT ..."
 *
 * Or, with a .env at the repo root:
 *   node scripts/query.mjs "SELECT ..."
 *
 * No transaction is opened or assumed beyond whatever the SQL string itself
 * contains - if you need BEGIN/COMMIT, put them in the string yourself
 * (see db/manual/005_role_tiers.sql's own STEP markers for why that matters:
 * some statements, like ALTER TYPE ... ADD VALUE, must not share a
 * transaction with statements that use the new value).
 */
import { readFileSync, existsSync } from 'node:fs';
import pg from 'pg';

const sql = process.argv[2];
if (!sql) {
  console.error('Usage: node scripts/query.mjs "<SQL>"');
  process.exit(1);
}

// Best-effort .env load, without requiring dotenv to be present.
if (!process.env.DATABASE_URL && existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*(DATABASE_URL|POSTGRES_URL)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!connectionString) {
  console.error('No DATABASE_URL (or POSTGRES_URL) in the environment or .env.');
  console.error("Get it from the platform service's environment in Coolify, then:");
  console.error('  DATABASE_URL=\'postgres://...\' node scripts/query.mjs "<SQL>"');
  process.exit(1);
}

const redacted = connectionString.replace(/\/\/[^@]*@/, '//***:***@');
const client = new pg.Client({ connectionString });

try {
  await client.connect();
  console.log(`Connected to ${redacted}`);
  const result = await client.query(sql);
  const results = Array.isArray(result) ? result : [result];
  for (const r of results) {
    if (r.rows?.length) {
      console.table(r.rows);
    } else {
      console.log(`OK - ${r.rowCount ?? 0} row(s) affected, no rows returned.`);
    }
  }
} catch (error) {
  console.error(`Query FAILED: ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
