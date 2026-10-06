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
