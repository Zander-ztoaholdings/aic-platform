#!/usr/bin/env node
/**
 * Applies a hand-written SQL migration using the repo's own `pg` dependency.
 *
 * Exists because `psql` is not installed on every machine that needs to apply
 * one of these, and installing Postgres client tools just to run a file is a
 * poor reason to block a migration. `pg` is already a dependency here.
 *
 * The file is sent as a single statement batch, so the BEGIN/COMMIT inside each
 * migration governs atomicity exactly as it would under psql — a failure rolls
 * the whole file back and leaves the database untouched.
 *
 *   DATABASE_URL='postgres://…' node scripts/apply-sql.mjs db/manual/002_evidence_chain.sql
 *
 * Or, with a .env at the repo root:
 *   node scripts/apply-sql.mjs db/manual/002_evidence_chain.sql
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/apply-sql.mjs <path-to-.sql>');
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
  console.error('Get it from the platform service\'s environment in Coolify, then:');
  console.error("  DATABASE_URL='postgres://…' node scripts/apply-sql.mjs " + file);
  process.exit(1);
}

const path = resolve(file);
const sql = readFileSync(path, 'utf8');
const redacted = connectionString.replace(/\/\/[^@]*@/, '//***:***@');

const client = new pg.Client({ connectionString });

try {
  await client.connect();
  console.log(`Connected to ${redacted}`);
  console.log(`Applying ${file} (${sql.split('\n').length} lines)…`);
  await client.query(sql);
  console.log(`✓ ${file} applied.`);
} catch (error) {
  console.error(`✗ ${file} FAILED — nothing was changed.`);
  console.error(`  ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
