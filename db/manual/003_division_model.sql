-- Adopt the published Division model, and record which standard an
-- organisation is actually being assessed against.
--
-- WHY THIS EXISTS.
--
-- The platform and the published standard disagreed about what an organisation
-- even is. Signup asked for an "AI Risk Tier" — TIER_1 Critical / TIER_2
-- Elevated / TIER_3 Standard — a concept that appears nowhere in the standard
-- at aiccertified.cloud/standard. Meanwhile the standard's actual axes are:
--
--   * Division 1–5 (Sovereign, Supervised, Reviewed, Monitored, Artificial) —
--     modes of operation, not grades, and the thing that determines WHICH of
--     the 44 requirements apply. Only 16 are universal.
--   * Evidence tier A–D — a weight on evidence quality (operational data 1.0
--     down to bare attestation 0.4). Not something a customer picks.
--   * The five Rights (HU/EX/EM/CO/TR), aggregated as a geometric mean with
--     per-right floors.
--
-- Signup never asked for Division, so the requirement set it generated could
-- not have been right for anyone. It seeded eight hand-written requirements
-- instead, whose text exists in no published document — and two of those were
-- invisible in the UI anyway, carrying category REPORTS while /roadmap renders
-- only DOCUMENTATION, TECHNICAL and OVERSIGHT.
--
-- This migration adds the columns needed to seed from the real standard and to
-- record which version was used. Requirement rows now carry their published
-- code (HU-1), the Right they serve, and the evidence the standard actually
-- asks for — so an assessment can be traced back to the clause it came from.
--
-- `tier` is deliberately left in place and untouched. Existing rows have
-- values, several pages display it, and retiring it is a separate decision
-- from starting to record Division correctly.
--
-- WHY HAND-WRITTEN: same as 001 and 002 — `drizzle-kit generate` stops on an
-- unresolved enum-rename prompt in db/migrations/meta. Additive only,
-- idempotent, drops nothing.
--
-- APPLY WITH:
--   psql "$DATABASE_URL" -f db/manual/003_division_model.sql
--
-- Safe to run more than once. Apply 002_evidence_chain.sql first.

BEGIN;

-- ── 0. Preflight ────────────────────────────────────────────────────────────
DO $$
DECLARE
  missing text[];
BEGIN
  SELECT array_agg(t) INTO missing
  FROM unnest(ARRAY['organizations', 'audit_requirements']) AS t
  WHERE to_regclass('public.' || t) IS NULL;

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot apply 003_division_model: prerequisite table(s) missing: %.',
      array_to_string(missing, ', ');
  END IF;
END $$;

-- ── 1. An organisation is assessed in a Division, against a standard version ─
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS division         smallint,
  ADD COLUMN IF NOT EXISTS standard_version varchar(20);

DO $$ BEGIN
  ALTER TABLE organizations ADD CONSTRAINT organizations_division_check
    CHECK (division IS NULL OR division BETWEEN 1 AND 5) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN organizations.division IS
  '1 Sovereign, 2 Supervised, 3 Reviewed, 4 Monitored, 5 Artificial. Determines which of the published requirements apply. NULL for organisations created before the Division model was adopted.';

-- ── 2. A requirement row points back at the published clause it came from ────
-- `right_code`, not `right`: RIGHT is a reserved word in Postgres and a column
-- called that would need quoting at every single call site forever.
ALTER TABLE audit_requirements
  ADD COLUMN IF NOT EXISTS code              varchar(20),
  ADD COLUMN IF NOT EXISTS right_code        varchar(4),
  ADD COLUMN IF NOT EXISTS evidence_guidance text,
  ADD COLUMN IF NOT EXISTS standard_version  varchar(20);

DO $$ BEGIN
  ALTER TABLE audit_requirements ADD CONSTRAINT audit_requirements_right_code_check
    CHECK (right_code IS NULL OR right_code IN ('HU', 'EX', 'EM', 'CO', 'TR')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- An organisation gets each published requirement at most once. Partial, so
-- the legacy hand-written rows (which have no code) are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS audit_requirements_org_code_uniq
  ON audit_requirements(org_id, code) WHERE code IS NOT NULL;

CREATE INDEX IF NOT EXISTS audit_requirements_right_code_idx
  ON audit_requirements(right_code);

COMMENT ON COLUMN audit_requirements.code IS
  'Published requirement code, e.g. HU-1. NULL means a legacy row predating the adoption of the published standard.';

COMMIT;
