-- 015_frameworks.sql
--
-- Frameworks beyond AIC's own: which ones an organisation tracks, and the
-- frameworks it writes for itself (a customer's security schedule, an
-- internal standard). The published frameworks themselves live in the code
-- (apps/platform/lib/frameworks/data), not in the database.
--
-- Additive and safe to run more than once. Nothing existing reads these
-- tables, so it can go in before or after the code that uses them; until it
-- is applied, the Frameworks page says so and Controls shows the defaults.

CREATE TABLE IF NOT EXISTS org_frameworks (
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  framework_key varchar(80) NOT NULL,
  added_by uuid REFERENCES users(id) ON DELETE SET NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, framework_key)
);

CREATE TABLE IF NOT EXISTS custom_frameworks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL,
  description text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS custom_frameworks_org_idx ON custom_frameworks (org_id);

CREATE TABLE IF NOT EXISTS custom_framework_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id uuid NOT NULL REFERENCES custom_frameworks(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  position integer NOT NULL,
  ref varchar(40) NOT NULL,
  title text NOT NULL,
  controls text[] NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS custom_framework_requirements_fw_idx ON custom_framework_requirements (framework_id, position);

-- ── Row-level security and grants for the new tables ─────────────────────────
DO $outer$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['org_frameworks', 'custom_frameworks', 'custom_framework_requirements'] LOOP
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
