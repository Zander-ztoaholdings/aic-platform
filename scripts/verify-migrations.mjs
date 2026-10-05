#!/usr/bin/env node
/**
 * Reports which hand-written migrations have actually reached this database,
 * and whether tenant isolation is really being enforced.
 *
 * Exists because this deployment has twice discovered a missing migration by
 * watching a page fail in production. `db/manual/` has no tracking table, so
 * "was this applied?" has been a manual check nobody had a command for.
 *
 *   node scripts/verify-migrations.mjs
 *   DATABASE_URL='postgres://…' node scripts/verify-migrations.mjs
 *
 * Exits non-zero if anything is missing, so it can gate a deploy.
 */
import { readFileSync, existsSync } from 'node:fs';
import pg from 'pg';

if (!process.env.DATABASE_URL && existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*(DATABASE_URL|POSTGRES_URL)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!connectionString) {
  console.error('No DATABASE_URL (or POSTGRES_URL) in the environment or .env.');
  process.exit(1);
}

const client = new pg.Client({ connectionString });

const ok = (s) => `  \x1b[32m✓\x1b[0m ${s}`;
const bad = (s) => `  \x1b[31m✗\x1b[0m ${s}`;
const warn = (s) => `  \x1b[33m!\x1b[0m ${s}`;

async function one(sql, params = []) {
  const { rows } = await client.query(sql, params);
  return rows[0];
}

const hasTable = (t) => one(`SELECT to_regclass($1) IS NOT NULL AS yes`, [`public.${t}`]).then((r) => r.yes);
const hasColumn = (t, c) =>
  one(
    `SELECT EXISTS (SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1 AND column_name=$2) AS yes`,
    [t, c]
  ).then((r) => r.yes);

let failures = 0;
const check = (cond, good, bad_) => {
  if (cond) console.log(ok(good));
  else { console.log(bad(bad_)); failures++; }
};

try {
  await client.connect();
} catch (error) {
  console.error(`\nCould not connect: ${error.message}`);
  console.error('Check DATABASE_URL, and that this shell can reach the database host.\n');
  process.exit(1);
}

try {

const who = await one(
  `SELECT current_user AS who,
          (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS superuser`
);
console.log(`\nConnected as \x1b[1m${who.who}\x1b[0m${who.superuser ? ' (superuser)' : ''}\n`);

console.log('Migrations');
check(await hasTable('aware_assessments'), '001 aware tables', '001 aware tables MISSING');
check(await hasColumn('audit_documents', 'file_checksum'), '002 evidence chain', '002 evidence chain MISSING');
check(await hasColumn('organizations', 'division'), '003 division model', '003 division model MISSING');
check(await hasTable('estate_events'), '004 continuity record', '004 continuity record MISSING');
check(await hasColumn('users', 'role'), '005 role tiers', '005 role tiers MISSING');
check(await hasTable('llm_usage_records'), '006 llm usage monitoring', '006 llm usage monitoring MISSING  <-- /overview fails without this');
check(await hasColumn('organizations', 'solely_automated'), '007 signup profile', '007 signup profile MISSING  <-- registration silently drops the extra detail');
check(
  (await one(`SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='aic_tenant') AS yes`)).yes,
  '008 tenant isolation',
  '008 tenant isolation MISSING'
);
check(await hasColumn('hitl_logs', 'org_id'), '009 hitl org scope', '009 hitl org scope MISSING  <-- certificate issuance fails once the new code deploys');
check(await hasTable('aware_badges') && await hasColumn('aware_assessments', 'attested_at'), '010 aware badges', '010 aware badges MISSING  <-- /aware and badge verification fail without this');
check(await hasTable('integrations') && await hasTable('integration_checks'), '011 integrations', '011 integrations MISSING  <-- Connected systems and Automated checks fail without this');
check(await hasColumn('api_keys', 'key_lookup'), '012 api key lookup', '012 api key lookup MISSING  <-- creating an API key fails without this');
check(await hasTable('org_policies') && await hasTable('policy_acceptances'), '013 policies', '013 policies MISSING  <-- the Policies pages fail without this');
check(await hasTable('trust_pages') && await hasTable('questionnaire_items') && await hasColumn('decision_records', 'review_status'), '014 trust, spend, review', '014 trust, spend, review MISSING  <-- recording any decision fails without this');
check(await hasTable('org_frameworks') && await hasTable('custom_framework_requirements'), '015 frameworks', '015 frameworks MISSING  <-- choosing frameworks and custom frameworks fail without this');
check(await hasTable('suppliers') && await hasTable('risks') && await hasTable('access_review_items') && await hasTable('org_people'), '016 registers and people', '016 registers and people MISSING  <-- Suppliers, Risks, Training, Access reviews and People fail without this');

console.log('\nRow-level security');
const rls = await one(`
  SELECT count(*) FILTER (WHERE relrowsecurity)        AS enabled,
         count(*) FILTER (WHERE relforcerowsecurity)   AS forced,
         count(*)                                      AS total
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname='public' AND c.relkind='r'`);
console.log(`  ${rls.enabled} of ${rls.total} tables have RLS enabled (${rls.forced} forced)`);

const owned = await one(
  `SELECT count(*)::int AS n
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity
     AND pg_get_userbyid(c.relowner) = current_user AND NOT c.relforcerowsecurity`
);
if (owned.n > 0) {
  console.log(
    warn(
      `${owned.n} RLS-enabled tables are owned by this role and not FORCEd — ` +
      `the policies do not apply to this connection.`
    )
  );
  console.log(
    `    That is expected for the owning connection. It is only a problem if the`
  );
  console.log(
    `    application is still using it for tenant queries — see TENANT_DATABASE_URL.`
  );
}

const tenant = await one(
  `SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname='aic_tenant'`
);
console.log('\nTenant role');
if (!tenant) {
  console.log(bad('aic_tenant does not exist — apply 008'));
  failures++;
} else {
  check(!tenant.rolsuper, 'aic_tenant is not a superuser', 'aic_tenant IS a superuser — it would bypass every policy');
  check(!tenant.rolbypassrls, 'aic_tenant does not bypass RLS', 'aic_tenant has BYPASSRLS — it would bypass every policy');
  const canLogin = await one(`SELECT rolcanlogin FROM pg_roles WHERE rolname='aic_tenant'`);
  if (!canLogin.rolcanlogin) console.log(warn('aic_tenant cannot log in yet'));
}

console.log(
  process.env.TENANT_DATABASE_URL
    ? ok('TENANT_DATABASE_URL is set — tenant queries use the restricted role')
    : warn('TENANT_DATABASE_URL is not set — tenant queries still run as the owner, so RLS is not enforced')
);

} catch (error) {
  console.error(`\nStopped: ${error.message}`);
  await client.end().catch(() => {});
  process.exit(1);
}

await client.end();

console.log(
  failures === 0
    ? '\n\x1b[32mAll migrations present.\x1b[0m\n'
    : `\n\x1b[31m${failures} problem(s) above.\x1b[0m\n`
);
process.exit(failures === 0 ? 0 : 1);
