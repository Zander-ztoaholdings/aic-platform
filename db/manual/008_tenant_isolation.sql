-- 008_tenant_isolation.sql
--
-- Makes row-level security actually enforce, and extends it to the tables it
-- never covered.
--
-- ─── THE PROBLEM ───────────────────────────────────────────────────────────
--
-- 1. ENABLE WITHOUT FORCE IS A NO-OP FOR THE TABLE OWNER. 21 tables carry
--    `ENABLE ROW LEVEL SECURITY` and a matching isolation policy, and the
--    application connects with a single DATABASE_URL whose role owns those
--    tables. Postgres exempts a table's owner from ENABLE. Every one of those
--    policies has therefore been inert in production. db/manual/004 states
--    this outright and says it was verified against a live database; it forced
--    the two tables it introduced and left the audit of the rest outstanding.
--    This is that audit.
--
-- 2. THIRTEEN TABLES CARRYING org_id HAD NO WORKING RLS AT ALL. Two of them —
--    audit_documents and issued_certifications — have a CREATE POLICY with no
--    ENABLE anywhere, which does nothing whatsoever: a policy on a table
--    without RLS enabled is never consulted. The other eleven were never
--    addressed.
--
-- ─── THE FIX, AND WHY IT IS SAFE TO APPLY NOW ──────────────────────────────
--
-- This migration is INERT ON APPLICATION. It creates a restricted role and
-- extends policy coverage, but the application keeps connecting as the owner
-- until TENANT_DATABASE_URL is set, and the owner bypasses all of it. Nothing
-- changes the moment you run this. The switch is the environment variable, and
-- it can be thrown and withdrawn without another migration.
--
-- The design is the standard two-role split rather than FORCE ROW LEVEL
-- SECURITY. FORCE would apply to the owner too, and the owner is exactly what
-- getSystemDb() uses for the work that is legitimately cross-organisation:
-- registration inserting a new organisation, the auth callbacks, the public
-- register, admin tooling. Forcing those tables would break registration on the
-- first INSERT, because a policy with USING and no WITH CHECK applies its USING
-- expression to inserts, and app.current_org_id is not set when the
-- organisation being inserted does not exist yet.
--
-- So: getSystemDb() keeps the owning connection and keeps bypassing. The tenant
-- path gets a role that owns nothing, and for that role the existing policies
-- start working for the first time.
--
-- ─── AFTER APPLYING ────────────────────────────────────────────────────────
--
-- The role is created WITHOUT a password on purpose — a credential does not
-- belong in a migration in version control. Set one out of band:
--
--   ALTER ROLE aic_tenant WITH PASSWORD '<generated>';
--
-- then set TENANT_DATABASE_URL in Coolify to the same connection string as
-- DATABASE_URL with the user and password swapped for aic_tenant. Verify with
-- the queries in SECURITY-RLS-RUNBOOK.md before and after.
--
-- ON MISSING TABLES. Every table block below checks that the table exists and
-- carries an org_id column before touching it, and skips with a NOTICE
-- otherwise. Migrations in this deployment have demonstrably lagged behind the
-- code — 006 reached production only after /overview began failing on it — so a
-- file that aborts wholesale on the first table an older database happens not
-- to have is a file that cannot be run safely. Each block stands alone.
--
-- Idempotent and additive. Safe to re-run.


-- ─── 1. The restricted application role ────────────────────────────────────
--
-- Owns nothing, inherits nothing, and is explicitly NOSUPERUSER NOBYPASSRLS so
-- that a future grant cannot quietly hand it the exemption this whole file
-- exists to remove.

DO $outer$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aic_tenant') THEN
    CREATE ROLE aic_tenant LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  ELSE
    ALTER ROLE aic_tenant NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END $outer$;

GRANT USAGE ON SCHEMA public TO aic_tenant;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO aic_tenant;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO aic_tenant;

-- Tables and sequences created after this runs are covered without a follow-up
-- migration. Without this, the next table added would silently be unreadable to
-- the application the moment it started using the tenant role.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO aic_tenant;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO aic_tenant;


-- ─── 2. Coverage for the thirteen tables that had none ─────────────────────
--
-- Each carries org_id and each is reached through getTenantDb() on the client
-- path. The policy is the same expression the existing twelve use, so there is
-- one isolation rule in this database rather than two dialects of one.

DO $outer$
BEGIN
  IF to_regclass('public.accountable_persons') IS NULL THEN
    RAISE NOTICE 'skipping accountable_persons: table not present in this database';
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'accountable_persons' AND column_name = 'org_id'
  ) THEN
    RAISE NOTICE 'skipping accountable_persons: no org_id column';
  ELSE
    EXECUTE 'ALTER TABLE "accountable_persons" ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'accountable_persons_isolation_policy') THEN
      EXECUTE 'CREATE POLICY accountable_persons_isolation_policy ON "accountable_persons" '
              'USING (org_id = NULLIF(current_setting(''app.current_org_id'', TRUE), '''')::uuid) '
              'WITH CHECK (org_id = NULLIF(current_setting(''app.current_org_id'', TRUE), '''')::uuid)';
      RAISE NOTICE 'protected accountable_persons';
    ELSE
      RAISE NOTICE 'accountable_persons: policy already present, RLS enabled';
    END IF;
  END IF;
END $outer$;

DO $outer$
BEGIN
  IF to_regclass('public.ai_systems') IS NULL THEN
    RAISE NOTICE 'skipping ai_systems: table not present in this database';
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ai_systems' AND column_name = 'org_id'
  ) THEN
    RAISE NOTICE 'skipping ai_systems: no org_id column';
  ELSE
    EXECUTE 'ALTER TABLE "ai_systems" ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'ai_systems_isolation_policy') THEN
      EXECUTE 'CREATE POLICY ai_systems_isolation_policy ON "ai_systems" '
              'USING (org_id = NULLIF(current_setting(''app.current_org_id'', TRUE), '''')::uuid) '
              'WITH CHECK (org_id = NULLIF(current_setting(''app.current_org_id'', TRUE), '''')::uuid)';
      RAISE NOTICE 'protected ai_systems';
    ELSE
      RAISE NOTICE 'ai_systems: policy already present, RLS enabled';
    END IF;
  END IF;
END $outer$;

DO $outer$
BEGIN
  IF to_regclass('public.aims_assessments') IS NULL THEN
    RAISE NOTICE 'skipping aims_assessments: table not present in this database';
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aims_assessments' AND column_name = 'org_id'
  ) THEN
    RAISE NOTICE 'skipping aims_assessments: no org_id column';
  ELSE
    EXECUTE 'ALTER TABLE "aims_assessments" ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'aims_assessments_isolation_policy') THEN
      EXECUTE 'CREATE POLICY aims_assessments_isolation_policy ON "aims_assessments" '
              'USING (org_id = NULLIF(current_setting(''app.current_org_id'', TRUE), '''')::uuid) '
              'WITH CHECK (org_id = NULLIF(current_setting(''app.current_org_id'', TRUE), '''')::uuid)';
      RAISE NOTICE 'protected aims_assessments';
    ELSE
      RAISE NOTICE 'aims_assessments: policy already present, RLS enabled';
    END IF;
  END IF;
END $outer$;

DO $outer$
BEGIN
  IF to_regclass('public.audit_documents') IS NULL THEN
    RAISE NOTICE 'skipping audit_documents: table not present in this database';
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_documents' AND column_name = 'org_id'
  ) THEN
    RAISE NOTICE 'skipping audit_documents: no org_id column';
  ELSE
    EXECUTE 'ALTER TABLE "audit_documents" ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'audit_documents_isolation_policy') THEN
      EXECUTE 'CREATE POLICY audit_documents_isolation_policy ON "audit_documents" '
              'USING (org_id = NULLIF(current_setting(''app.current_org_id'', TRUE), '''')::uuid) '
              'WITH CHECK (org_id = NULLIF(current_setting(''app.current_org_id'', TRUE), '''')::uuid)';
      RAISE NOTICE 'protected audit_documents';
    ELSE
      RAISE NOTICE 'audit_documents: policy already present, RLS enabled';
    END IF;
  END IF;
END $outer$;

DO $outer$
BEGIN
  IF to_regclass('public.audit_findings') IS NULL THEN
    RAISE NOTICE 'skipping audit_findings: table not present in this database';
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_findings' AND column_name = 'org_id'
  ) THEN
    RAISE NOTICE 'skipping audit_findings: no org_id column';
  ELSE
    EXECUTE 'ALTER TABLE "audit_findings" ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'audit_findings_isolation_policy') THEN
      EXECUTE 'CREATE POLICY audit_findings_isolation_policy ON "audit_findings" '
              'USING (org_id = NULLIF(current_setting(''app.current_org_id'', TRUE), '''')::uuid) '
              'WITH CHECK (org_id = NULLIF(current_setting(''app.current_org_id'', TRUE), '''')::uuid)';
      RAISE NOTICE 'protected audit_findings';
    ELSE
      RAISE NOTICE 'audit_findings: policy already present, RLS enabled';
    END IF;
  END IF;
END $outer$;

DO $outer$
BEGIN
  IF to_regclass('public.audit_ledger') IS NULL THEN
    RAISE NOTICE 'skipping audit_ledger: table not present in this database';
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_ledger' AND column_name = 'org_id'
  ) THEN
    RAISE NOTICE 'skipping audit_ledger: no org_id column';
  ELSE
    EXECUTE 'ALTER TABLE "audit_ledger" ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'audit_ledger_isolation_policy') THEN
      EXECUTE 'CREATE POLICY audit_ledger_isolation_policy ON "audit_ledger" '
              'USING (org_id = NULLIF(current_setting(''app.current_org_id'', TRUE), '''')::uuid) '
              'WITH CHECK (org_id = NULLIF(current_setting(''app.current_org_id'', TRUE), '''')::uuid)';
      RAISE NOTICE 'protected audit_ledger';
    ELSE
      RAISE NOTICE 'audit_ledger: policy already present, RLS enabled';
    END IF;
  END IF;
END $outer$;

DO $outer$
BEGIN
  IF to_regclass('public.aware_assessments') IS NULL THEN
    RAISE NOTICE 'skipping aware_assessments: table not present in this database';
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aware_assessments' AND column_name = 'org_id'
  ) THEN
    RAISE NOTICE 'skipping aware_assessments: no org_id column';
  ELSE
    EXECUTE 'ALTER TABLE "aware_assessments" ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'aware_assessments_isolation_policy') THEN
      EXECUTE 'CREATE POLICY aware_assessments_isolation_policy ON "aware_assessments" '
              'USING (org_id = NULLIF(current_setting(''app.current_org_id'', TRUE), '''')::uuid) '
              'WITH CHECK (org_id = NULLIF(current_setting(''app.current_org_id'', TRUE), '''')::uuid)';
      RAISE NOTICE 'protected aware_assessments';
    ELSE
      RAISE NOTICE 'aware_assessments: policy already present, RLS enabled';
    END IF;
  END IF;
END $outer$;

DO $outer$
BEGIN
  IF to_regclass('public.conflict_checks') IS NULL THEN
    RAISE NOTICE 'skipping conflict_checks: table not present in this database';
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'conflict_checks' AND column_name = 'org_id'
  ) THEN
    RAISE NOTICE 'skipping conflict_checks: no org_id column';
  ELSE
    EXECUTE 'ALTER TABLE "conflict_checks" ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'conflict_checks_isolation_policy') THEN
      EXECUTE 'CREATE POLICY conflict_checks_isolation_policy ON "conflict_checks" '
              'USING (org_id = NULLIF(current_setting(''app.current_org_id'', TRUE), '''')::uuid) '
              'WITH CHECK (org_id = NULLIF(current_setting(''app.current_org_id'', TRUE), '''')::uuid)';
      RAISE NOTICE 'protected conflict_checks';
    ELSE
      RAISE NOTICE 'conflict_checks: policy already present, RLS enabled';
    END IF;
  END IF;
END $outer$;

DO $outer$
BEGIN
  IF to_regclass('public.corrective_actions') IS NULL THEN
    RAISE NOTICE 'skipping corrective_actions: table not present in this database';
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'corrective_actions' AND column_name = 'org_id'
  ) THEN
    RAISE NOTICE 'skipping corrective_actions: no org_id column';
  ELSE
    EXECUTE 'ALTER TABLE "corrective_actions" ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'corrective_actions_isolation_policy') THEN
      EXECUTE 'CREATE POLICY corrective_actions_isolation_policy ON "corrective_actions" '
              'USING (org_id = NULLIF(current_setting(''app.current_org_id'', TRUE), '''')::uuid) '
              'WITH CHECK (org_id = NULLIF(current_setting(''app.current_org_id'', TRUE), '''')::uuid)';
      RAISE NOTICE 'protected corrective_actions';
    ELSE
      RAISE NOTICE 'corrective_actions: policy already present, RLS enabled';
    END IF;
  END IF;
END $outer$;

DO $outer$
BEGIN
  IF to_regclass('public.governance_blocks') IS NULL THEN
    RAISE NOTICE 'skipping governance_blocks: table not present in this database';
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'governance_blocks' AND column_name = 'org_id'
  ) THEN
    RAISE NOTICE 'skipping governance_blocks: no org_id column';
  ELSE
    EXECUTE 'ALTER TABLE "governance_blocks" ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'governance_blocks_isolation_policy') THEN
      EXECUTE 'CREATE POLICY governance_blocks_isolation_policy ON "governance_blocks" '
              'USING (org_id = NULLIF(current_setting(''app.current_org_id'', TRUE), '''')::uuid) '
              'WITH CHECK (org_id = NULLIF(current_setting(''app.current_org_id'', TRUE), '''')::uuid)';
      RAISE NOTICE 'protected governance_blocks';
    ELSE
      RAISE NOTICE 'governance_blocks: policy already present, RLS enabled';
    END IF;
  END IF;
END $outer$;

DO $outer$
BEGIN
  IF to_regclass('public.invite_codes') IS NULL THEN
    RAISE NOTICE 'skipping invite_codes: table not present in this database';
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invite_codes' AND column_name = 'org_id'
  ) THEN
    RAISE NOTICE 'skipping invite_codes: no org_id column';
  ELSE
    EXECUTE 'ALTER TABLE "invite_codes" ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'invite_codes_isolation_policy') THEN
      EXECUTE 'CREATE POLICY invite_codes_isolation_policy ON "invite_codes" '
              'USING (org_id = NULLIF(current_setting(''app.current_org_id'', TRUE), '''')::uuid) '
              'WITH CHECK (org_id = NULLIF(current_setting(''app.current_org_id'', TRUE), '''')::uuid)';
      RAISE NOTICE 'protected invite_codes';
    ELSE
      RAISE NOTICE 'invite_codes: policy already present, RLS enabled';
    END IF;
  END IF;
END $outer$;

DO $outer$
BEGIN
  IF to_regclass('public.issued_certifications') IS NULL THEN
    RAISE NOTICE 'skipping issued_certifications: table not present in this database';
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'issued_certifications' AND column_name = 'org_id'
  ) THEN
    RAISE NOTICE 'skipping issued_certifications: no org_id column';
  ELSE
    EXECUTE 'ALTER TABLE "issued_certifications" ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'issued_certifications_isolation_policy') THEN
      EXECUTE 'CREATE POLICY issued_certifications_isolation_policy ON "issued_certifications" '
              'USING (org_id = NULLIF(current_setting(''app.current_org_id'', TRUE), '''')::uuid) '
              'WITH CHECK (org_id = NULLIF(current_setting(''app.current_org_id'', TRUE), '''')::uuid)';
      RAISE NOTICE 'protected issued_certifications';
    ELSE
      RAISE NOTICE 'issued_certifications: policy already present, RLS enabled';
    END IF;
  END IF;
END $outer$;

DO $outer$
BEGIN
  IF to_regclass('public.public_index_rankings') IS NULL THEN
    RAISE NOTICE 'skipping public_index_rankings: table not present in this database';
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'public_index_rankings' AND column_name = 'org_id'
  ) THEN
    RAISE NOTICE 'skipping public_index_rankings: no org_id column';
  ELSE
    EXECUTE 'ALTER TABLE "public_index_rankings" ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'public_index_rankings_isolation_policy') THEN
      EXECUTE 'CREATE POLICY public_index_rankings_isolation_policy ON "public_index_rankings" '
              'USING (org_id = NULLIF(current_setting(''app.current_org_id'', TRUE), '''')::uuid) '
              'WITH CHECK (org_id = NULLIF(current_setting(''app.current_org_id'', TRUE), '''')::uuid)';
      RAISE NOTICE 'protected public_index_rankings';
    ELSE
      RAISE NOTICE 'public_index_rankings: policy already present, RLS enabled';
    END IF;
  END IF;
END $outer$;


-- ─── 3. What this does NOT do ──────────────────────────────────────────────
--
-- It does not protect a table that has no org_id. system_ledger, roles and
-- capabilities are global by design and are reached through getSystemDb();
-- their protection is the capability check in front of the route, not a row
-- policy. hitl_logs was in that category and should not have been — see
-- db/manual/009_hitl_org_scope.sql.
--
-- It does not narrow what an AIC auditor can read at the database layer. That
-- is enforced in the application: /api/v1/admin/organizations returns an
-- auditor only the organisations assigned to them.
