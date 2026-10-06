-- ── Assignments: which AIC auditor looks after which organisation ───────────
--
-- Fragment for 018. Each organisation has at most one current lead (the
-- auditor who holds the file and does the assessment) and at most one current
-- reviewer (a second auditor, so no file is seen by one person only). A row is
-- current while ended_at is null; ending a row keeps it, so the table is its
-- own history: who held the file, from when, until when, who decided and why.
--
-- AIC's own table: no organisation reads it, so it has no row-level policy and
-- is withheld from aic_tenant (008 grants every new table to that role by
-- default, so the revoke below is needed, not decorative).
--
-- organizations.auditor_id stays the field the evidence screens check. The
-- application keeps it equal to the current lead; the backfill below starts
-- the history from whoever holds each file today.
--
-- Additive and safe to run more than once.

CREATE TABLE IF NOT EXISTS org_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role varchar(20) NOT NULL,
  assigned_by uuid REFERENCES users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL,
  ended_at timestamptz,
  ended_by uuid REFERENCES users(id) ON DELETE SET NULL,
  end_reason text,
  CONSTRAINT org_assignments_role CHECK (role IN ('lead', 'reviewer')),
  CONSTRAINT org_assignments_reason CHECK (length(trim(reason)) > 0),
  CONSTRAINT org_assignments_end CHECK (ended_at IS NULL OR ended_at >= assigned_at)
);

-- One current lead and one current reviewer per organisation, and never the
-- same person in both seats (four eyes).
CREATE UNIQUE INDEX IF NOT EXISTS org_assignments_one_lead
  ON org_assignments (org_id) WHERE ended_at IS NULL AND role = 'lead';
CREATE UNIQUE INDEX IF NOT EXISTS org_assignments_one_reviewer
  ON org_assignments (org_id) WHERE ended_at IS NULL AND role = 'reviewer';
CREATE UNIQUE INDEX IF NOT EXISTS org_assignments_one_seat
  ON org_assignments (org_id, user_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS org_assignments_user_idx
  ON org_assignments (user_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS org_assignments_org_idx
  ON org_assignments (org_id, assigned_at DESC);

DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aic_tenant') THEN
    EXECUTE 'REVOKE ALL ON org_assignments FROM aic_tenant';
  END IF;
END $outer$;

-- Start the history from the files already held. Skips an organisation that
-- already has a current lead, so re-running adds nothing.
INSERT INTO org_assignments (org_id, user_id, role, assigned_at, reason)
SELECT o.id, o.auditor_id, 'lead', now(), 'Carried over: already held the file when assignments started.'
FROM organizations o
JOIN users u ON u.id = o.auditor_id
WHERE o.auditor_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM org_assignments a
    WHERE a.org_id = o.id AND a.role = 'lead' AND a.ended_at IS NULL
  );
