-- Which migrations has this database actually had?
--
-- /overview and /dashboard 500 when a table or column they read does not
-- exist, and the error in the container log is a bare Postgres relation/column
-- error that does not say which migration is missing. This says it directly.
--
-- Paste into the Coolify Postgres terminal (662 chars, inside the 2046 limit).
-- No output at all means the schema is complete.
--
--   accountable_persons, aware_assessments          -> db/manual/001
--   audit_findings, corrective_actions, audit_documents.* -> db/manual/002
--   organizations.division, audit_requirements.right_code -> db/manual/003
--   estate_events, estate_snapshots                 -> db/manual/004

SELECT 'MISSING TABLE  '||t AS issue FROM unnest(ARRAY['accountable_persons','aware_assessments','audit_findings','corrective_actions','ai_systems','estate_events','estate_snapshots']) t WHERE to_regclass('public.'||t) IS NULL
UNION ALL
SELECT 'MISSING COLUMN '||c FROM unnest(ARRAY['audit_documents.verification_outcome','audit_documents.verified_at','audit_documents.requirement_id','organizations.division','organizations.standard_version','audit_requirements.right_code','audit_requirements.code']) c WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=split_part(c,'.',1) AND column_name=split_part(c,'.',2));
