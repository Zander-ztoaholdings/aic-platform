-- 006_llm_usage_monitoring.sql
--
-- Adds llm_usage_records: provider/model usage and spend, as reported by an
-- organisation's own tooling (a nightly export or webhook), for AIC to
-- surface as part of the AI Overview and cross-check against the declared
-- inventory. Full rationale in packages/db/src/schema.ts's comment on the
-- table.
--
-- This does NOT change what AIC holds or calls. AIC never requests or
-- stores an Anthropic/OpenAI/DeepSeek credential and never calls a provider
-- itself - see app/overview/page.tsx's READ_ONLY_MECHANISM string, which
-- this table is built to keep true, not work around. Ingestion is via the
-- same aic_live_ API key (or session) pattern /api/decisions already uses -
-- a caller pushes numbers it already computed; AIC never reaches out to
-- pull them.
--
-- Idempotent: every statement below is guarded (IF NOT EXISTS / CREATE OR
-- REPLACE), so a second run is a no-op.

CREATE TABLE IF NOT EXISTS "llm_usage_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "provider" varchar(100) NOT NULL,
  "model" varchar(150),
  "system_name" varchar(255),
  "period_start" timestamptz NOT NULL,
  "period_end" timestamptz NOT NULL,
  "requests" integer,
  "input_tokens" bigint,
  "output_tokens" bigint,
  "cost_usd" numeric(12, 4),
  "region" varchar(100),
  "source" varchar(50) NOT NULL DEFAULT 'export',
  "ingested_via" varchar(20) NOT NULL,
  "submitted_by" uuid REFERENCES "users"("id"),
  "created_at" timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "llm_usage_org_provider_idx" ON "llm_usage_records" ("org_id", "provider");
CREATE INDEX IF NOT EXISTS "llm_usage_org_period_idx" ON "llm_usage_records" ("org_id", "period_start");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'llm_usage_dedupe'
  ) THEN
    ALTER TABLE "llm_usage_records"
      ADD CONSTRAINT "llm_usage_dedupe"
      UNIQUE ("org_id", "provider", "model", "period_start", "period_end");
  END IF;
END $$;

-- Tenant isolation, same policy shape as every other org-scoped table in
-- rls_policies.sql (decision_records, scheduled_audits, etc.) - RLS-forced,
-- not just filtered in application code.
ALTER TABLE "llm_usage_records" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS llm_usage_records_isolation_policy ON "llm_usage_records";
CREATE POLICY llm_usage_records_isolation_policy ON "llm_usage_records"
USING (org_id = NULLIF(current_setting('app.current_org_id', TRUE), '')::uuid)
WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', TRUE), '')::uuid);
