-- 009_hitl_org_scope.sql
--
-- Attributes human-oversight records to an organisation.
--
-- hitl_logs records that a named person overrode an automated decision. Under
-- HU-2 that row is the evidence an organisation produces to show a human was
-- answerable for an outcome. It had no org_id, which meant two things:
--
--   * the row could not be produced as any particular organisation's evidence
--     without joining back through whichever target it happened to reference,
--     and for some target types there is no such join;
--   * no row-level security policy could cover it, so it sat outside tenant
--     isolation entirely while carrying some of the most sensitive content in
--     the schema — what a decision was before a human changed it, and why.
--
-- The column is NULLABLE deliberately. Rows written before it existed cannot
-- be attributed after the fact, and guessing an attribution for a human
-- oversight record would be a worse fault than leaving it blank. They stay
-- visible to the owning connection and are excluded from tenant reads, which
-- is the honest treatment: they are historical rows of unknown provenance.
--
-- Additive, guarded, safe to re-run.

ALTER TABLE hitl_logs ADD COLUMN IF NOT EXISTS org_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hitl_logs_org_id_fkey'
  ) THEN
    ALTER TABLE hitl_logs
      ADD CONSTRAINT hitl_logs_org_id_fkey
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS hitl_logs_org_id_idx ON hitl_logs (org_id);

ALTER TABLE hitl_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'hitl_logs_isolation_policy') THEN
    CREATE POLICY hitl_logs_isolation_policy ON "hitl_logs"
      USING (org_id = NULLIF(current_setting('app.current_org_id', TRUE), '')::uuid)
      WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', TRUE), '')::uuid);
  END IF;
END $$;
