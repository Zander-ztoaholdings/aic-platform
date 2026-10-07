-- 020_ai_tool_use.sql
--
-- AI use inside the tools an organisation already runs: Claude and ChatGPT
-- seats, Claude Code, Microsoft 365 Copilot, GitHub Copilot, Gemini in Google
-- Workspace, and AI services in AWS, Azure and Google Cloud. API spend per
-- model stays in llm_usage_records; this table is who (or which model) used
-- which AI product on which day, as the vendor reports it.
--
-- One row per organisation, product, subject and day. A subject is a person
-- (email or login) or, for cloud AI services that report no person, a model
-- or deployment. Pulling the same day again overwrites rather than adds.
--
-- Tenant table: row-level policy, granted to aic_tenant.
-- Additive and safe to run more than once.

CREATE TABLE IF NOT EXISTS ai_tool_use (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product varchar(40) NOT NULL,
  source varchar(40) NOT NULL,
  subject_type varchar(10) NOT NULL DEFAULT 'person',
  subject varchar(255) NOT NULL,
  display_name varchar(255),
  day date NOT NULL,
  last_active_at timestamptz,
  activity bigint NOT NULL DEFAULT 0,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_tool_use_subject_type CHECK (subject_type IN ('person', 'model')),
  CONSTRAINT ai_tool_use_dedupe UNIQUE (org_id, product, subject_type, subject, day)
);
CREATE INDEX IF NOT EXISTS ai_tool_use_org_day_idx ON ai_tool_use (org_id, day DESC);
CREATE INDEX IF NOT EXISTS ai_tool_use_org_product_idx ON ai_tool_use (org_id, product);

DO $outer$
BEGIN
  ALTER TABLE ai_tool_use ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'ai_tool_use_isolation_policy') THEN
    CREATE POLICY ai_tool_use_isolation_policy ON ai_tool_use
      USING (org_id = NULLIF(current_setting('app.current_org_id', TRUE), '')::uuid)
      WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', TRUE), '')::uuid);
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aic_tenant') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON ai_tool_use TO aic_tenant;
  END IF;
END $outer$;
