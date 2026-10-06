-- 018_risk_assignments_links.sql
--
--   1. The live risk register: where each risk came from (library, AIC signal
--      or a person), acceptance with approver and expiry, the history of each
--      risk, and signals a client dismissed.
--   2. Assignments: which AIC auditor leads, and which reviews, each
--      organisation.
--   3. Client onboarding links AIC staff send a new client.
--
-- Additive and safe to run more than once.

-- 018 fragment: the live risk register.
--
--   1. New columns on risks: where a risk came from (typed by a person, added
--      from AIC's risk library, or raised by an AIC signal), which library
--      template and signals it is linked to, and, for an accepted risk, who
--      approved the acceptance, why, and until when.
--   2. risk_events: the history of each risk (created, scored, treatment,
--      reviewed, signal, closed, reopened), shown as a timeline.
--   3. risk_signal_dismissals: suggestions an organisation chose not to add,
--      with the reason, so AIC does not raise the same thing again.
--
-- Additive and safe to run more than once.

-- ── Risks: new columns ───────────────────────────────────────────────────────
ALTER TABLE risks ADD COLUMN IF NOT EXISTS source varchar(20) NOT NULL DEFAULT 'manual';
ALTER TABLE risks ADD COLUMN IF NOT EXISTS library_key varchar(60);
ALTER TABLE risks ADD COLUMN IF NOT EXISTS signal_keys text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE risks ADD COLUMN IF NOT EXISTS accepted_by varchar(200);
ALTER TABLE risks ADD COLUMN IF NOT EXISTS accept_reason text;
ALTER TABLE risks ADD COLUMN IF NOT EXISTS accept_until date;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'risks_source') THEN
    ALTER TABLE risks ADD CONSTRAINT risks_source CHECK (source IN ('manual', 'library', 'signal'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS risks_org_library_idx ON risks (org_id, library_key);

-- ── Risk events ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS risk_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id uuid NOT NULL REFERENCES risks(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind varchar(20) NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}',
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT risk_events_kind CHECK (kind IN ('created', 'scored', 'treatment', 'reviewed', 'signal', 'closed', 'reopened'))
);
CREATE INDEX IF NOT EXISTS risk_events_risk_idx ON risk_events (risk_id, created_at);
CREATE INDEX IF NOT EXISTS risk_events_org_idx ON risk_events (org_id, created_at DESC);

-- ── Dismissed suggestions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS risk_signal_dismissals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  signal_key varchar(60) NOT NULL,
  subject varchar(255) NOT NULL,
  reason text NOT NULL,
  dismissed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT risk_signal_dismissals_org_signal_subject UNIQUE (org_id, signal_key, subject)
);

-- ── Row-level security and grants for the organisation tables ───────────────
DO $outer$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['risk_events', 'risk_signal_dismissals'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = t || '_isolation_policy') THEN
      EXECUTE format('CREATE POLICY %I ON %I '
        'USING (org_id = NULLIF(current_setting(''app.current_org_id'', TRUE), '''')::uuid) '
        'WITH CHECK (org_id = NULLIF(current_setting(''app.current_org_id'', TRUE), '''')::uuid)',
        t || '_isolation_policy', t);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aic_tenant') THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO aic_tenant', t);
    END IF;
  END LOOP;
END $outer$;

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

-- ── Client onboarding links ─────────────────────────────────────────────────
--
-- Fragment for 018. A link AIC staff send to a prospective client. It opens a
-- welcome page and the registration wizard with the organisation and contact
-- filled in, and on registration assigns the chosen (or default) AIC lead.
-- The token grants nothing on its own: registration is public anyway. It only
-- carries the prefill and the assignment, so it is stored as is, and staff can
-- copy it again.
--
-- AIC's own table: no row-level policy, withheld from aic_tenant.
-- Additive and safe to run more than once.

CREATE TABLE IF NOT EXISTS client_onboarding_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token varchar(64) NOT NULL UNIQUE,
  org_name varchar(200),
  contact_name varchar(200),
  contact_email varchar(255),
  preferred_lead_id uuid REFERENCES users(id) ON DELETE SET NULL,
  note text,
  max_uses integer NOT NULL DEFAULT 1,
  uses integer NOT NULL DEFAULT 0,
  used_org_ids uuid[] NOT NULL DEFAULT '{}',
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  CONSTRAINT client_onboarding_links_uses CHECK (max_uses BETWEEN 1 AND 100 AND uses >= 0)
);
CREATE INDEX IF NOT EXISTS client_onboarding_links_created_idx ON client_onboarding_links (created_at DESC);

DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aic_tenant') THEN
    EXECUTE 'REVOKE ALL ON client_onboarding_links FROM aic_tenant';
  END IF;
END $outer$;
