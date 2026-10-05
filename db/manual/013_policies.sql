-- 013_policies.sql
--
-- Policies an organisation adopts, the versions it publishes, and who has
-- accepted which version. Rationale on orgPolicies in packages/db/src/schema.ts.
-- Additive and guarded. Safe to re-run.

CREATE TABLE IF NOT EXISTS org_policies (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  template_key       varchar(60),
  title              varchar(255) NOT NULL,
  body               text NOT NULL,
  published_version  integer NOT NULL DEFAULT 0,
  owner_id           uuid REFERENCES users(id) ON DELETE SET NULL,
  review_due_at      timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS org_policies_org_idx ON org_policies (org_id);

CREATE TABLE IF NOT EXISTS policy_versions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  policy_id     uuid NOT NULL REFERENCES org_policies(id) ON DELETE CASCADE,
  version       integer NOT NULL,
  title         varchar(255) NOT NULL,
  body          text NOT NULL,
  body_hash     varchar(64) NOT NULL,
  published_at  timestamptz NOT NULL DEFAULT now(),
  published_by  uuid REFERENCES users(id) ON DELETE SET NULL
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'policy_versions_policy_version') THEN
    ALTER TABLE policy_versions ADD CONSTRAINT policy_versions_policy_version UNIQUE (policy_id, version);
  END IF;
END $$;

-- A published version is evidence; it must not change after the fact.
CREATE OR REPLACE FUNCTION policy_versions_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'a published policy version cannot be changed';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS policy_versions_no_update ON policy_versions;
CREATE TRIGGER policy_versions_no_update BEFORE UPDATE ON policy_versions FOR EACH ROW EXECUTE FUNCTION policy_versions_immutable();

CREATE TABLE IF NOT EXISTS policy_acceptances (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  policy_id    uuid NOT NULL REFERENCES org_policies(id) ON DELETE CASCADE,
  version      integer NOT NULL,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  accepted_at  timestamptz NOT NULL DEFAULT now()
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'policy_acceptances_once') THEN
    ALTER TABLE policy_acceptances ADD CONSTRAINT policy_acceptances_once UNIQUE (policy_id, version, user_id);
  END IF;
END $$;

-- Tenant isolation, as for every org-scoped table.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['org_policies', 'policy_versions', 'policy_acceptances'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_isolation_policy', t);
    EXECUTE format($p$CREATE POLICY %I ON %I USING (org_id = NULLIF(current_setting('app.current_org_id', TRUE), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', TRUE), '')::uuid)$p$, t || '_isolation_policy', t);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aic_tenant') THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO aic_tenant', t);
    END IF;
  END LOOP;
END $$;
