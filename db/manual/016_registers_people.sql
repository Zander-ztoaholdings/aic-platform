-- 016_registers_people.sql
--
-- The registers a security programme keeps, and its people:
--   1. Suppliers and their reviews (POPIA ss20-21, ISO 27001 A.5.19-A.5.22).
--   2. The risk register (ISO 27001 clause 6.1, ISO 42001 6.1, NIST CSF ID.RA).
--   3. Training: which modules an organisation requires, and who completed them.
--   4. Access reviews: a campaign, and a decision on every account in it.
--   5. People: joiners and leavers, from HR systems or entered by hand, so
--      AIC can check a leaver no longer has access.
--
-- Additive and safe to run more than once. Nothing existing reads these
-- tables; until it is applied, the new pages say so.

-- ── Suppliers ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name varchar(200) NOT NULL,
  website varchar(300),
  category varchar(40) NOT NULL DEFAULT 'software',
  purpose text,
  data_shared text[] NOT NULL DEFAULT '{}',
  outside_sa boolean NOT NULL DEFAULT false,
  country varchar(80),
  criticality varchar(10) NOT NULL DEFAULT 'medium',
  has_dpa boolean NOT NULL DEFAULT false,
  owner_name varchar(200),
  status varchar(20) NOT NULL DEFAULT 'active',
  source varchar(60) NOT NULL DEFAULT 'manual',
  next_review_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT suppliers_criticality CHECK (criticality IN ('high', 'medium', 'low')),
  CONSTRAINT suppliers_status CHECK (status IN ('active', 'offboarded'))
);
CREATE INDEX IF NOT EXISTS suppliers_org_idx ON suppliers (org_id, status);

CREATE TABLE IF NOT EXISTS supplier_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  outcome varchar(30) NOT NULL,
  notes text,
  document_id uuid REFERENCES audit_documents(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  next_review_at timestamptz,
  CONSTRAINT supplier_reviews_outcome CHECK (outcome IN ('approved', 'approved_with_conditions', 'rejected'))
);
CREATE INDEX IF NOT EXISTS supplier_reviews_supplier_idx ON supplier_reviews (supplier_id, reviewed_at DESC);

-- ── Risks ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title varchar(200) NOT NULL,
  description text,
  category varchar(30) NOT NULL DEFAULT 'security',
  likelihood smallint NOT NULL,
  impact smallint NOT NULL,
  residual_likelihood smallint,
  residual_impact smallint,
  treatment varchar(20) NOT NULL DEFAULT 'mitigate',
  treatment_plan text,
  controls text[] NOT NULL DEFAULT '{}',
  owner_name varchar(200),
  status varchar(20) NOT NULL DEFAULT 'open',
  review_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT risks_scores CHECK (likelihood BETWEEN 1 AND 5 AND impact BETWEEN 1 AND 5
    AND (residual_likelihood IS NULL OR residual_likelihood BETWEEN 1 AND 5)
    AND (residual_impact IS NULL OR residual_impact BETWEEN 1 AND 5)),
  CONSTRAINT risks_treatment CHECK (treatment IN ('mitigate', 'accept', 'transfer', 'avoid')),
  CONSTRAINT risks_status CHECK (status IN ('open', 'treating', 'accepted', 'closed'))
);
CREATE INDEX IF NOT EXISTS risks_org_idx ON risks (org_id, status);

-- ── Training ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_training (
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_key varchar(60) NOT NULL,
  required boolean NOT NULL DEFAULT true,
  every_months smallint NOT NULL DEFAULT 12,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, module_key)
);

CREATE TABLE IF NOT EXISTS training_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_key varchar(60) NOT NULL,
  module_version varchar(20) NOT NULL,
  score smallint NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS training_completions_org_idx ON training_completions (org_id, module_key, completed_at DESC);

-- ── Access reviews ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS access_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name varchar(200) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'open',
  due_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  completed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT access_reviews_status CHECK (status IN ('open', 'completed'))
);
CREATE INDEX IF NOT EXISTS access_reviews_org_idx ON access_reviews (org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS access_review_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES access_reviews(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  system varchar(80) NOT NULL,
  account varchar(255) NOT NULL,
  display_name varchar(255),
  privilege varchar(120),
  last_active_at timestamptz,
  decision varchar(20),
  note text,
  decided_by uuid REFERENCES users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  removed_at timestamptz,
  CONSTRAINT access_review_items_decision CHECK (decision IS NULL OR decision IN ('keep', 'remove', 'reduce')),
  CONSTRAINT access_review_items_decided CHECK (decision IS NULL OR (decided_by IS NOT NULL AND decided_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS access_review_items_review_idx ON access_review_items (review_id);

-- ── People ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name varchar(200) NOT NULL,
  email varchar(255),
  job_title varchar(200),
  department varchar(120),
  start_date date,
  end_date date,
  source varchar(60) NOT NULL DEFAULT 'manual',
  external_id varchar(120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS org_people_org_idx ON org_people (org_id, end_date);
CREATE UNIQUE INDEX IF NOT EXISTS org_people_source_ext ON org_people (org_id, source, external_id) WHERE external_id IS NOT NULL;

-- ── Row-level security and grants ────────────────────────────────────────────
DO $outer$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['suppliers', 'supplier_reviews', 'risks', 'org_training', 'training_completions', 'access_reviews', 'access_review_items', 'org_people'] LOOP
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
