-- 012_api_key_lookup.sql
--
-- API keys were verified by bcrypt-comparing the presented key against every
-- active key in the table, one by one. Fine at five keys; at fifty it is slow,
-- and anyone could make the server do fifty bcrypt comparisons per request by
-- sending a made-up key. key_lookup holds a SHA-256 of the key so the one
-- candidate row is found by index, and bcrypt then verifies only that row.
--
-- Existing keys get their lookup value the first time they are used (the old
-- scan still runs for rows where it is NULL). New keys get it at creation.
--
-- Additive and guarded. Safe to re-run.

ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key_lookup varchar(64);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_key_lookup_unique') THEN
    ALTER TABLE api_keys ADD CONSTRAINT api_keys_key_lookup_unique UNIQUE (key_lookup);
  END IF;
END $$;

-- The tables 011 added, granted explicitly to the restricted role in case 011
-- ran before 008 set default privileges.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aic_tenant') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON integrations, integration_checks TO aic_tenant;
  END IF;
END $$;
