-- 005_role_tiers.sql
--
-- Migrates users.role and invite_codes.role from the old client-only
-- ADMIN / AUDITOR / COMPLIANCE_OFFICER / VIEWER set to the new 4-tier
-- model (Zander, 2026-09): AIC_SUPER_ADMIN > AIC_AUDITOR > ORG_ADMIN >
-- ORG_USER. Full rationale in apps/platform/lib/roles.ts's file header.
--
-- READ THIS BEFORE RUNNING STEP 2.
--
-- Two of the mappings below are CAPABILITY CHANGES for any real user who
-- holds them today, not just a rename:
--
--   VIEWER (read-only)            -> ORG_USER (full day-to-day access)
--   AUDITOR with an org_id set    -> ORG_USER (full day-to-day access)
--
-- The 4-tier model has no read-only org tier and no org-side "independent
-- reviewer" tier, so both collapse into ORG_USER, which can declare
-- systems, submit evidence and record decisions. Run STEP 0 first and
-- look at the counts before running STEP 2 - if you have a real client
-- user on VIEWER today who should stay read-only, or a real org-level
-- AUDITOR who should stay unable to edit the estate, stop and say so
-- before this runs, because there's no tier left to put them back on
-- afterwards without a code change.
--
-- Idempotent: safe to run more than once (each UPDATE only touches rows
-- still on a legacy value, so a second run is a no-op).

-- ── STEP 0: PREVIEW. Run this first, on its own, and read the result. ──
-- SELECT role, org_id IS NULL AS is_orgless, is_super_admin, COUNT(*)
--   FROM users
--   GROUP BY role, org_id IS NULL, is_super_admin
--   ORDER BY role;

-- ── STEP 1: add the four new enum values. Each ALTER TYPE ADD VALUE must
--    commit on its own (Postgres won't let a new enum value be used in the
--    same transaction that adds it) - do not wrap these in BEGIN/COMMIT. ──
ALTER TYPE user_role_enum ADD VALUE IF NOT EXISTS 'AIC_SUPER_ADMIN';
ALTER TYPE user_role_enum ADD VALUE IF NOT EXISTS 'AIC_AUDITOR';
ALTER TYPE user_role_enum ADD VALUE IF NOT EXISTS 'ORG_ADMIN';
ALTER TYPE user_role_enum ADD VALUE IF NOT EXISTS 'ORG_USER';

-- ── STEP 2: remap existing rows, and switch the column defaults. ──
BEGIN;

-- users: straightforward renames first (no capability change)
UPDATE users SET role = 'ORG_ADMIN' WHERE role = 'ADMIN';
UPDATE users SET role = 'ORG_USER'  WHERE role = 'COMPLIANCE_OFFICER';

-- users: AUDITOR splits on whether the account has an org. The demo seed
-- script (scripts/seed-demo-org.ts) models an orgless AUDITOR as an AIC
-- assessor - that's the AIC_AUDITOR reading. An org-scoped AUDITOR was the
-- customer's own independent reviewer; there's no equivalent tier left, so
-- it becomes ORG_USER (CAPABILITY CHANGE - see the note above STEP 0).
UPDATE users SET role = 'AIC_AUDITOR' WHERE role = 'AUDITOR' AND org_id IS NULL;
UPDATE users SET role = 'ORG_USER'    WHERE role = 'AUDITOR' AND org_id IS NOT NULL;

-- users: VIEWER has no read-only equivalent left (CAPABILITY CHANGE - see
-- the note above STEP 0).
UPDATE users SET role = 'ORG_USER' WHERE role = 'VIEWER';

-- users: is_super_admin is the actual security gate (lib/rbac.ts,
-- hasCapability, every isSuperAdmin check) and stays exactly as it is -
-- this only keeps the `role` label in sync with it for display purposes,
-- and wins over whatever the row's role happened to be above.
UPDATE users SET role = 'AIC_SUPER_ADMIN' WHERE is_super_admin = TRUE AND role <> 'AIC_SUPER_ADMIN';

-- invite_codes: same mapping, for invites nobody has redeemed yet.
UPDATE invite_codes SET role = 'ORG_ADMIN' WHERE role = 'ADMIN';
UPDATE invite_codes SET role = 'ORG_USER'  WHERE role IN ('COMPLIANCE_OFFICER', 'VIEWER');
UPDATE invite_codes SET role = 'AIC_AUDITOR' WHERE role = 'AUDITOR' AND org_id IS NULL;
UPDATE invite_codes SET role = 'ORG_USER'    WHERE role = 'AUDITOR' AND org_id IS NOT NULL;

-- New default for any row inserted between this migration and the next
-- deploy of the application code (which also sets ORG_USER as the
-- Drizzle-level default in packages/db/src/schema.ts).
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'ORG_USER';
ALTER TABLE invite_codes ALTER COLUMN role SET DEFAULT 'ORG_USER';

COMMIT;

-- ── STEP 3: verify. Every row should now be on a new-tier value; this
--    should return zero rows. ──
-- SELECT id, email, role FROM users
--   WHERE role IN ('ADMIN', 'AUDITOR', 'COMPLIANCE_OFFICER', 'VIEWER');
