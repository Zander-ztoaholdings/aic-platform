-- 010_aware_badges.sql
--
-- AIC Aware badges, issued only from a platform account.
--
-- Until now the badge lived on the website and was looked up by company NAME.
-- Anyone could enter any work email, type "Standard Bank", tick "list me", and
-- the site would serve a badge reading "AIC Aware · Standard Bank". Nothing
-- tied the declaration to the organisation it named, two submissions with the
-- same name collided, a second submission from the same email silently
-- rewrote the first, badges never expired, and the answers behind a badge were
-- not kept at all.
--
-- A badge is now a row here. It is issued when a registered organisation —
-- with a named accountable person who has signed the declaration (HU-1, HU-2)
-- — submits AIC Aware in the platform. It carries an unguessable public code,
-- the organisation's name frozen as it was when the declaration was made, the
-- question-set version it was answered against, and a twelve-month expiry.
-- It can be revoked, and a revocation must say why.
--
-- Additive and guarded. Safe to re-run.

CREATE TABLE IF NOT EXISTS aware_badges (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                   varchar(20)  NOT NULL UNIQUE,
  org_id                 uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assessment_id          uuid         NOT NULL REFERENCES aware_assessments(id) ON DELETE CASCADE,
  accountable_person_id  uuid         REFERENCES accountable_persons(id) ON DELETE SET NULL,
  issued_by              uuid         REFERENCES users(id) ON DELETE SET NULL,

  -- Frozen at issue. Renaming the organisation later must not change what the
  -- organisation declared under, or what an old badge claims.
  org_name_at_issue      varchar(255) NOT NULL,
  question_set_version   varchar(20)  NOT NULL,

  -- Public directory opt-in. Off unless the organisation turns it on.
  listed                 boolean      NOT NULL DEFAULT false,

  issued_at              timestamptz  NOT NULL DEFAULT now(),
  expires_at             timestamptz  NOT NULL,

  revoked_at             timestamptz,
  revoked_by             uuid         REFERENCES users(id) ON DELETE SET NULL,
  revocation_reason      text,

  CONSTRAINT aware_badges_revocation_has_reason
    CHECK (revoked_at IS NULL OR revocation_reason IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS aware_badges_org_idx ON aware_badges (org_id);
CREATE INDEX IF NOT EXISTS aware_badges_directory_idx
  ON aware_badges (issued_at DESC) WHERE listed = true AND revoked_at IS NULL;

ALTER TABLE aware_badges ENABLE ROW LEVEL SECURITY;
DO $outer$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'aware_badges_isolation_policy') THEN
    CREATE POLICY aware_badges_isolation_policy ON "aware_badges"
      USING (org_id = NULLIF(current_setting('app.current_org_id', TRUE), '')::uuid)
      WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', TRUE), '')::uuid);
  END IF;
END $outer$;

-- Who attested, and when, and what the scorer said — recorded on the
-- assessment itself so the badge's basis is recoverable from the record.
ALTER TABLE aware_assessments ADD COLUMN IF NOT EXISTS attested_at timestamptz;
ALTER TABLE aware_assessments ADD COLUMN IF NOT EXISTS attested_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE aware_assessments ADD COLUMN IF NOT EXISTS result      jsonb;

-- aic_tenant (008) gets default privileges on new tables, but only if 008 ran
-- first. Granting explicitly makes the order of the two irrelevant.
DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aic_tenant') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON aware_badges TO aic_tenant;
  END IF;
END $outer$;
