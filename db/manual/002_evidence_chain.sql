-- The evidence chain: requirement → evidence → verification → finding →
-- corrective action → certification decision, and a certificate that can
-- actually change state afterwards.
--
-- WHY THIS EXISTS.
--
-- Before this migration the platform could not answer the first question any
-- accreditation body or insurer asks: "who checked this, when, and how was it
-- closed?" Concretely, as of 8 Sep 2026:
--
--   * audit_documents had no requirement_id. Evidence was matched to a
--     requirement by a free-text slot_type compared against a four-item
--     hardcoded array, so an evidence item could not be traced to the
--     requirement it satisfies.
--   * No table anywhere carried verified_by or verified_at. The act of
--     verification left no record of who performed it.
--   * There was no findings table. audit_requirements.findings was a single
--     text column overwritten by each scan — no severity, no owner, no due
--     date, no closure state.
--   * There was no non-conformity or corrective-action concept at all.
--     (correction_requests is a different domain object: a data-subject
--     appeal against a decision_records row under POPIA s71.)
--   * issued_certifications was never updated by any code path. status was an
--     unconstrained varchar, so a certificate could not be suspended, revoked
--     or expired — it stayed ACTIVE past its own expiry_date and the public
--     register kept saying so.
--   * A certificate carried no link to the assessment that justified it, so
--     its evidentiary basis was not recoverable from the record.
--
-- WHY IT IS HAND-WRITTEN. Same reason as 001: `drizzle-kit generate` stops on
-- an unresolved enum-rename prompt in db/migrations/meta, and answering it
-- wrong drops an enum and cascades. That is a question for someone who knows
-- the history. This migration is additive only, idempotent, and drops nothing.
--
-- APPLY WITH:
--   psql "$DATABASE_URL" -f db/manual/002_evidence_chain.sql
--
-- It can be run more than once without harm. Afterwards the drizzle snapshots
-- will not know about these objects — already true of this database; do not run
-- `drizzle-kit push` to "fix" it (see scripts/db-push-guard.mjs).

BEGIN;

-- ── 0. Preflight ────────────────────────────────────────────────────────────
-- This migration ALTERs audit_documents and issued_certifications and points a
-- foreign key at aims_assessments. None of those three tables is created by any
-- file in db/migrations/ — they exist only in packages/db/src/schema.ts, which
-- means they reached this database (if they did) through a `drizzle-kit push`
-- that left no migration behind. So their presence cannot be assumed from the
-- repo alone.
--
-- Rather than fail two hundred lines in with a bare "relation does not exist",
-- check up front and say exactly what is missing. Everything is inside one
-- transaction, so a failure here leaves the database untouched.
DO $$
DECLARE
  missing text[];
BEGIN
  SELECT array_agg(t) INTO missing
  FROM unnest(ARRAY[
    'organizations', 'users', 'audit_requirements',
    'audit_documents', 'issued_certifications', 'aims_assessments'
  ]) AS t
  WHERE to_regclass('public.' || t) IS NULL;

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot apply 002_evidence_chain: prerequisite table(s) missing: %. '
      'These are defined in packages/db/src/schema.ts but created by no file in '
      'db/migrations/, so this database is behind the schema. Create them before '
      'applying this migration — and do NOT run `drizzle-kit push` to do it '
      '(see scripts/db-push-guard.mjs).',
      array_to_string(missing, ', ');
  END IF;
END $$;

-- ── 1. Evidence can be tied to a requirement, and to the act of verifying it ─
-- A row here is a claim that a specific document satisfies a specific
-- requirement, checked by a specific person at a specific time. All three parts
-- are needed; the first two alone are just file storage.
ALTER TABLE audit_documents
  ADD COLUMN IF NOT EXISTS requirement_id       uuid REFERENCES audit_requirements(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_at          timestamptz,
  ADD COLUMN IF NOT EXISTS verification_outcome varchar(30),
  ADD COLUMN IF NOT EXISTS verification_notes   text,
  -- Evidence is superseded, never overwritten: what was relied on at the time
  -- of a decision has to stay readable after the decision.
  ADD COLUMN IF NOT EXISTS superseded_by        uuid REFERENCES audit_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at           timestamptz DEFAULT now();

DO $$ BEGIN
  ALTER TABLE audit_documents
    ADD CONSTRAINT audit_documents_verification_outcome_check
    CHECK (verification_outcome IS NULL OR verification_outcome IN
      ('ACCEPTED', 'REJECTED', 'INSUFFICIENT')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- A verification is either complete or absent — never half-recorded.
DO $$ BEGIN
  ALTER TABLE audit_documents
    ADD CONSTRAINT audit_documents_verification_complete_check
    CHECK (
      (verified_by IS NULL AND verified_at IS NULL AND verification_outcome IS NULL)
      OR
      (verified_by IS NOT NULL AND verified_at IS NOT NULL AND verification_outcome IS NOT NULL)
    ) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS audit_documents_requirement_id_idx ON audit_documents(requirement_id);
CREATE INDEX IF NOT EXISTS audit_documents_verified_by_idx    ON audit_documents(verified_by);

-- ── 2. Auditor findings ─────────────────────────────────────────────────────
-- Severity vocabulary is taken from the existing AIC Audit and Certification
-- Methodology (v0.1) §5 — Major / Minor / Observation / Ethical concern — so
-- the system records findings in the same terms the methodology already
-- defines, rather than inventing a fifth grading vocabulary. (AIC currently has
-- three competing grading schemes across its documents; this deliberately does
-- not add another.)
CREATE TABLE IF NOT EXISTS audit_findings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requirement_id  uuid REFERENCES audit_requirements(id) ON DELETE SET NULL,
  -- The evidence the finding was raised against, where there is one. A finding
  -- can also be raised on absent evidence, which is why this is nullable.
  document_id     uuid REFERENCES audit_documents(id) ON DELETE SET NULL,

  raised_by       uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  severity        varchar(20) NOT NULL,
  title           varchar(255) NOT NULL,
  description     text NOT NULL,

  status          varchar(30) NOT NULL DEFAULT 'OPEN',
  raised_at       timestamptz NOT NULL DEFAULT now(),
  due_at          timestamptz,
  closed_at       timestamptz,
  closed_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  closure_notes   text,

  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE audit_findings ADD CONSTRAINT audit_findings_severity_check
    CHECK (severity IN ('MAJOR', 'MINOR', 'OBSERVATION', 'ETHICAL_CONCERN'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE audit_findings ADD CONSTRAINT audit_findings_status_check
    CHECK (status IN ('OPEN', 'RESPONSE_SUBMITTED', 'ACCEPTED', 'CLOSED', 'WITHDRAWN'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- A closed finding must say who closed it and when. Findings that quietly
-- disappear are the specific failure this table exists to prevent.
DO $$ BEGIN
  ALTER TABLE audit_findings ADD CONSTRAINT audit_findings_closure_check
    CHECK (
      status NOT IN ('CLOSED', 'WITHDRAWN')
      OR (closed_at IS NOT NULL AND closed_by IS NOT NULL)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS audit_findings_org_id_idx         ON audit_findings(org_id);
CREATE INDEX IF NOT EXISTS audit_findings_requirement_id_idx ON audit_findings(requirement_id);
CREATE INDEX IF NOT EXISTS audit_findings_status_idx         ON audit_findings(status);

-- ── 3. Corrective actions ───────────────────────────────────────────────────
-- The organisation's response to a finding, and AIC's review of that response.
-- Both halves live in one row so the loop cannot be left half-open.
CREATE TABLE IF NOT EXISTS corrective_actions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id            uuid NOT NULL REFERENCES audit_findings(id) ON DELETE CASCADE,
  org_id                uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- The organisation's side
  root_cause            text,
  action_taken          text NOT NULL,
  evidence_document_id  uuid REFERENCES audit_documents(id) ON DELETE SET NULL,
  submitted_by          uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  submitted_at          timestamptz NOT NULL DEFAULT now(),

  -- AIC's side
  reviewed_by           uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at           timestamptz,
  outcome               varchar(30),
  review_notes          text,

  created_at            timestamptz DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE corrective_actions ADD CONSTRAINT corrective_actions_outcome_check
    CHECK (outcome IS NULL OR outcome IN ('ACCEPTED', 'REJECTED', 'MORE_INFO_REQUIRED'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE corrective_actions ADD CONSTRAINT corrective_actions_review_complete_check
    CHECK (
      (reviewed_by IS NULL AND reviewed_at IS NULL AND outcome IS NULL)
      OR
      (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND outcome IS NOT NULL)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS corrective_actions_finding_id_idx ON corrective_actions(finding_id);
CREATE INDEX IF NOT EXISTS corrective_actions_org_id_idx     ON corrective_actions(org_id);

-- ── 4. Certificates that can change state ───────────────────────────────────
-- A register that can only ever add rows, and never withdraw one, is worse than
-- no register: it makes a stale certificate look current forever.
ALTER TABLE issued_certifications
  ADD COLUMN IF NOT EXISTS suspended_at       timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS suspension_reason  text,
  ADD COLUMN IF NOT EXISTS revoked_at         timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_by         uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revocation_reason  text,
  ADD COLUMN IF NOT EXISTS reinstated_at      timestamptz,
  ADD COLUMN IF NOT EXISTS reinstated_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  -- The assessment that justified issuing this certificate. Without it, the
  -- evidentiary basis for a certificate is not recoverable from its own record.
  ADD COLUMN IF NOT EXISTS assessment_id      uuid REFERENCES aims_assessments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at         timestamptz DEFAULT now();

-- NOT VALID so this cannot fail on pre-existing rows; it still constrains every
-- insert and update from here on.
DO $$ BEGIN
  ALTER TABLE issued_certifications
    ADD CONSTRAINT issued_certifications_status_check
    CHECK (status IN ('ACTIVE', 'SUSPENDED', 'REVOKED', 'EXPIRED', 'WITHDRAWN')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- A certificate in a terminal or suspended state must say who put it there and
-- when — the same rule as findings, for the same reason.
DO $$ BEGIN
  ALTER TABLE issued_certifications
    ADD CONSTRAINT issued_certifications_state_evidence_check
    CHECK (
      (status <> 'SUSPENDED' OR (suspended_at IS NOT NULL AND suspension_reason IS NOT NULL))
      AND
      (status <> 'REVOKED'   OR (revoked_at   IS NOT NULL AND revocation_reason IS NOT NULL))
    ) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS issued_certifications_status_idx     ON issued_certifications(status);
CREATE INDEX IF NOT EXISTS issued_certifications_expiry_idx     ON issued_certifications(expiry_date);
CREATE INDEX IF NOT EXISTS issued_certifications_assessment_idx ON issued_certifications(assessment_id);

COMMIT;
