-- 021_projects_shares.sql
--
-- Two things, both additive and safe to run more than once.
--
-- 1. Projects. Not every piece of work answers to the same frameworks. A
--    project groups the people working on it (each with a role), the
--    frameworks it must meet, the AI systems in its scope, and its own tasks.
--    Evidence still counts once across the organisation.
--
-- 2. Record shares. A client shares a period of its continuity record with a
--    named person, who must prove they are that person (a one-time code to
--    their email) before anything opens. Nothing leaves the platform as a
--    file that could be edited under AIC's name: the record is read live,
--    watermarked with the viewer, every view is logged, and the link expires
--    or can be withdrawn.
--
-- Tenant tables: row-level policy, granted to aic_tenant. Share lookups by
-- token and the code and view logs are written by the platform's own role.

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name varchar(160) NOT NULL,
  description text,
  status varchar(12) NOT NULL DEFAULT 'active',
  lead_id uuid REFERENCES users(id) ON DELETE SET NULL,
  due_date date,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT projects_status CHECK (status IN ('active', 'paused', 'done'))
);
CREATE INDEX IF NOT EXISTS projects_org_idx ON projects (org_id, status);

CREATE TABLE IF NOT EXISTS project_members (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role varchar(12) NOT NULL DEFAULT 'contributor',
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id),
  CONSTRAINT project_members_role CHECK (role IN ('lead', 'contributor', 'reviewer'))
);

CREATE TABLE IF NOT EXISTS project_frameworks (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  framework_key varchar(80) NOT NULL,
  PRIMARY KEY (project_id, framework_key)
);

CREATE TABLE IF NOT EXISTS project_systems (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  system_id uuid NOT NULL REFERENCES ai_systems(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, system_id)
);

CREATE TABLE IF NOT EXISTS project_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title varchar(300) NOT NULL,
  detail text,
  assignee_id uuid REFERENCES users(id) ON DELETE SET NULL,
  due_date date,
  status varchar(8) NOT NULL DEFAULT 'todo',
  framework_key varchar(80),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  done_at timestamptz,
  CONSTRAINT project_tasks_status CHECK (status IN ('todo', 'doing', 'done'))
);
CREATE INDEX IF NOT EXISTS project_tasks_project_idx ON project_tasks (project_id, status);

CREATE TABLE IF NOT EXISTS record_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token_hash varchar(64) NOT NULL UNIQUE,
  recipient_name varchar(200) NOT NULL,
  recipient_email varchar(255) NOT NULL,
  purpose text,
  from_date date NOT NULL,
  to_date date NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT record_shares_range CHECK (from_date <= to_date)
);
CREATE INDEX IF NOT EXISTS record_shares_org_idx ON record_shares (org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS record_share_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id uuid NOT NULL REFERENCES record_shares(id) ON DELETE CASCADE,
  code_hash varchar(64) NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS record_share_codes_share_idx ON record_share_codes (share_id, created_at DESC);

CREATE TABLE IF NOT EXISTS record_share_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id uuid NOT NULL REFERENCES record_shares(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  viewer_email varchar(255) NOT NULL,
  user_agent varchar(200),
  viewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS record_share_views_share_idx ON record_share_views (share_id, viewed_at DESC);

DO $outer$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['projects', 'project_members', 'project_frameworks', 'project_systems', 'project_tasks', 'record_shares', 'record_share_views'] LOOP
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
  -- One-time codes are AIC's own: never readable by the tenant role.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aic_tenant') THEN
    EXECUTE 'REVOKE ALL ON record_share_codes FROM aic_tenant';
  END IF;
END $outer$;
