-- AIC Aware: accountable persons and self-assessment state
--
-- WHY THIS IS HAND-WRITTEN AND NOT A DRIZZLE MIGRATION.
--
-- `drizzle-kit generate` cannot complete in this repo: it stops on an enum
-- conflict prompt, because the migration snapshots under db/migrations/meta
-- and the current schema disagree about enums. Resolving that prompt means
-- telling drizzle whether an enum was RENAMED or CREATED, and answering wrong
-- drops the enum and cascades into every column that uses it. That is a
-- question for someone who knows the history, not something to guess at, and
-- it is a pre-existing problem that predates this change.
--
-- Rather than resolve that under time pressure, this migration is written by
-- hand. It is additive only, idempotent, and drops nothing — so it is safe to
-- apply to a live database and simple enough to read in full before you do.
--
-- APPLY WITH:
--   psql "$DATABASE_URL" -f db/manual/001_aware_tables.sql
--
-- It can be run more than once without harm.
--
-- AFTERWARDS: the drizzle snapshots will not know these tables exist. That is
-- already true of the two repos' relationship to this database and is tracked
-- separately; do not run `drizzle-kit push` to "fix" it (see
-- scripts/db-push-guard.mjs for what that would destroy).

BEGIN;

-- ── The named individual a client puts forward as accountable ───────────────
-- HU-1 (an individual, not a role) and HU-2 (who has signed a declaration
-- acknowledging personal accountability). Rows are superseded, never
-- overwritten: who was accountable on the day a declaration was made is the
-- entire reason for recording it.
CREATE TABLE IF NOT EXISTS accountable_persons (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  nominated_by             uuid REFERENCES users(id) ON DELETE SET NULL,

  name                     varchar(255) NOT NULL,
  job_title                varchar(255),
  email                    varchar(255) NOT NULL,

  declaration_version      varchar(20)  NOT NULL,
  declaration_accepted_at  timestamptz  NOT NULL,

  -- Hashed, not raw: an IP address is personal information under POPIA, and
  -- the only thing it is needed for is disputing a repudiated signature.
  accepted_ip_hash         varchar(64),

  superseded_at            timestamptz,
  created_at               timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS accountable_persons_org_idx
  ON accountable_persons (org_id);

-- ── An AIC Aware self-assessment, in progress or submitted ──────────────────
-- `answers` is deliberately partial and written on every answer: that is what
-- makes save-and-resume work, and a row with four answers in it is a person
-- who stopped after four questions, which is worth knowing.
CREATE TABLE IF NOT EXISTS aware_assessments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id               uuid REFERENCES users(id) ON DELETE SET NULL,

  answers               jsonb DEFAULT '{}'::jsonb,

  -- IN_PROGRESS | SUBMITTED | ABANDONED
  status                varchar(20) NOT NULL DEFAULT 'IN_PROGRESS',

  -- Pinned at submission, for the same reason assessments.standard_version is:
  -- a result computed against a question set that has since changed cannot be
  -- reconstructed, and an unreconstructable result is not a record.
  question_set_version  varchar(20),

  -- Computed once, on submission. Never recomputed on read.
  score                 integer,
  indicated_division    varchar(1),

  started_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),
  submitted_at          timestamptz
);

CREATE INDEX IF NOT EXISTS aware_assessments_org_idx
  ON aware_assessments (org_id);
CREATE INDEX IF NOT EXISTS aware_assessments_user_idx
  ON aware_assessments (user_id);

COMMIT;
