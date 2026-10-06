-- 017_tools_markets.sql
--
--   1. Agents: the optional agent runtime. A client may deploy an agent
--      through AIC, scoped at runtime: which model, which tools, which
--      addresses, what needs a person's approval, and hard limits. Every step
--      of every run is recorded and chained. A tool, not part of
--      certification: using it neither raises nor lowers the chance of
--      being certified.
--   2. Model trials: results a client's own script sends back after running
--      a sample of its requests through a cheaper model. Scores only; AIC
--      never receives the prompts or answers.
--   3. Supplier document reads: what AIC's first read of a supplier's
--      security report or certificate found.
--   4. Connector runs: each connector run's outcome, so AIC can see which
--      connectors have worked against real accounts.
--   5. Markets: AIC's own jurisdiction tracker (HQ), with its history.
--
-- Additive and safe to run more than once.

-- ── Agents ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL,
  slug varchar(80) NOT NULL,
  purpose text,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ai_system_id uuid REFERENCES ai_systems(id) ON DELETE SET NULL,
  provider varchar(30) NOT NULL,
  model varchar(120) NOT NULL,
  instructions text NOT NULL DEFAULT '',
  tools jsonb NOT NULL DEFAULT '[]',
  limits jsonb NOT NULL DEFAULT '{}',
  status varchar(20) NOT NULL DEFAULT 'draft',
  model_key_ciphertext text,
  model_key_hint varchar(20),
  tool_secrets_ciphertext text,
  version integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agents_status CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  CONSTRAINT agents_provider CHECK (provider IN ('anthropic', 'openai')),
  CONSTRAINT agents_org_slug UNIQUE (org_id, slug)
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  agent_version integer NOT NULL,
  trigger varchar(20) NOT NULL,
  triggered_by uuid REFERENCES users(id) ON DELETE SET NULL,
  input text NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'running',
  output text,
  state jsonb NOT NULL DEFAULT '{}',
  steps integer NOT NULL DEFAULT 0,
  input_tokens bigint NOT NULL DEFAULT 0,
  output_tokens bigint NOT NULL DEFAULT 0,
  cost_usd numeric(12, 6) NOT NULL DEFAULT 0,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  CONSTRAINT agent_runs_status CHECK (status IN ('running', 'waiting_for_person', 'completed', 'failed', 'stopped', 'refused')),
  CONSTRAINT agent_runs_trigger CHECK (trigger IN ('person', 'api'))
);
CREATE INDEX IF NOT EXISTS agent_runs_agent_idx ON agent_runs (agent_id, started_at DESC);
CREATE INDEX IF NOT EXISTS agent_runs_org_idx ON agent_runs (org_id, started_at DESC);

CREATE TABLE IF NOT EXISTS agent_run_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  seq integer NOT NULL,
  kind varchar(30) NOT NULL,
  name varchar(120),
  detail jsonb NOT NULL DEFAULT '{}',
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  prev_hash varchar(64),
  hash varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_run_steps_seq UNIQUE (run_id, seq)
);

-- ── Model trials ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS model_trials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  from_model varchar(120) NOT NULL,
  to_model varchar(120) NOT NULL,
  method varchar(30) NOT NULL,
  samples integer NOT NULL,
  as_good integer NOT NULL DEFAULT 0,
  worse integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  from_cost_usd numeric(12, 6),
  to_cost_usd numeric(12, 6),
  from_latency_ms integer,
  to_latency_ms integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT model_trials_counts CHECK (samples > 0 AND as_good >= 0 AND worse >= 0 AND failed >= 0 AND as_good + worse + failed <= samples)
);
CREATE INDEX IF NOT EXISTS model_trials_org_idx ON model_trials (org_id, created_at DESC);

-- ── Supplier document reads ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supplier_document_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  document_id uuid REFERENCES audit_documents(id) ON DELETE SET NULL,
  file_name varchar(255) NOT NULL,
  findings jsonb NOT NULL DEFAULT '{}',
  read_by varchar(20) NOT NULL DEFAULT 'ai',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS supplier_document_reads_supplier_idx ON supplier_document_reads (supplier_id, created_at DESC);

-- ── Connector runs ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS connector_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connector varchar(40) NOT NULL,
  outcome varchar(20) NOT NULL,
  checks integer NOT NULL DEFAULT 0,
  unknown_checks integer NOT NULL DEFAULT 0,
  error text,
  demo boolean NOT NULL DEFAULT false,
  ran_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT connector_runs_outcome CHECK (outcome IN ('ok', 'error', 'disconnected'))
);
CREATE INDEX IF NOT EXISTS connector_runs_connector_idx ON connector_runs (connector, ran_at DESC);

-- ── Row-level security and grants for the organisation tables ───────────────
DO $outer$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['agents', 'agent_runs', 'agent_run_steps', 'model_trials', 'supplier_document_reads', 'connector_runs'] LOOP
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

-- ── Markets (AIC's own, HQ only; no organisation, so no row-level policy) ────
CREATE TABLE IF NOT EXISTS hq_jurisdictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(8) NOT NULL UNIQUE,
  name varchar(120) NOT NULL,
  region varchar(60),
  law text,
  automated_decision_section varchar(120),
  regulator varchar(200),
  stage varchar(20) NOT NULL DEFAULT 'watching',
  owner_name varchar(200),
  next_step text,
  next_step_due date,
  notes text,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hq_jurisdictions_stage CHECK (stage IN ('watching', 'mapped', 'preparing', 'entering', 'live', 'paused'))
);

CREATE TABLE IF NOT EXISTS hq_jurisdiction_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_id uuid NOT NULL REFERENCES hq_jurisdictions(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  from_stage varchar(20),
  to_stage varchar(20),
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hq_jurisdiction_events_idx ON hq_jurisdiction_events (jurisdiction_id, created_at DESC);

-- The three jurisdictions AIC had already mapped, carried over from the old
-- pages. Facts as recorded there; check them before relying on them.
INSERT INTO hq_jurisdictions (code, name, region, law, automated_decision_section, regulator, stage, notes) VALUES
  ('ZA', 'South Africa', 'SADC', 'Protection of Personal Information Act (POPIA)', 'Section 71', 'Information Regulator', 'live', 'Home market. The AIC standard is anchored on section 71.'),
  ('BW', 'Botswana', 'SADC', 'Data Protection Act 2018', 'Section 20', 'Information and Data Protection Commission', 'mapped', NULL),
  ('MU', 'Mauritius', 'SADC', 'Data Protection Act 2017', 'Section 38', 'Data Protection Commissioner', 'mapped', NULL)
ON CONFLICT (code) DO NOTHING;
