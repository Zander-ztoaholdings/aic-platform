-- 011_integrations.sql
--
-- Connected systems (GitHub, OpenAI, Anthropic) and the latest result of each
-- automated check. Full rationale on the integrations / integration_checks
-- tables in packages/db/src/schema.ts.
--
-- Additive and guarded. Safe to re-run.

CREATE TABLE IF NOT EXISTS integrations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider           varchar(30) NOT NULL,
  mode               varchar(20) NOT NULL,
  status             varchar(20) NOT NULL DEFAULT 'pending',
  external_id        varchar(100),
  account_label      varchar(255),
  secret_ciphertext  text,
  secret_hint        varchar(20),
  settings           jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at     timestamptz,
  last_error         text,
  connected_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'integrations_org_provider') THEN
    ALTER TABLE integrations ADD CONSTRAINT integrations_org_provider UNIQUE (org_id, provider);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS integration_checks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_id   uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  check_key        varchar(80) NOT NULL,
  subject          varchar(255) NOT NULL,
  status           varchar(10) NOT NULL,
  summary          text NOT NULL,
  detail           jsonb NOT NULL DEFAULT '{}'::jsonb,
  failing_since    timestamptz,
  observed_at      timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'integration_checks_org_check_subject') THEN
    ALTER TABLE integration_checks
      ADD CONSTRAINT integration_checks_org_check_subject UNIQUE (org_id, check_key, subject);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS integration_checks_org_status_idx ON integration_checks (org_id, status);

-- Tenant isolation, the same policy shape as every other org-scoped table.
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS integrations_isolation_policy ON integrations;
CREATE POLICY integrations_isolation_policy ON integrations
USING (org_id = NULLIF(current_setting('app.current_org_id', TRUE), '')::uuid)
WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', TRUE), '')::uuid);

ALTER TABLE integration_checks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS integration_checks_isolation_policy ON integration_checks;
CREATE POLICY integration_checks_isolation_policy ON integration_checks
USING (org_id = NULLIF(current_setting('app.current_org_id', TRUE), '')::uuid)
WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', TRUE), '')::uuid);
