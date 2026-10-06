-- ── Client onboarding links ─────────────────────────────────────────────────
--
-- Fragment for 018. A link AIC staff send to a prospective client. It opens a
-- welcome page and the registration wizard with the organisation and contact
-- filled in, and on registration assigns the chosen (or default) AIC lead.
-- The token grants nothing on its own: registration is public anyway. It only
-- carries the prefill and the assignment, so it is stored as is, and staff can
-- copy it again.
--
-- AIC's own table: no row-level policy, withheld from aic_tenant.
-- Additive and safe to run more than once.

CREATE TABLE IF NOT EXISTS client_onboarding_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token varchar(64) NOT NULL UNIQUE,
  org_name varchar(200),
  contact_name varchar(200),
  contact_email varchar(255),
  preferred_lead_id uuid REFERENCES users(id) ON DELETE SET NULL,
  note text,
  max_uses integer NOT NULL DEFAULT 1,
  uses integer NOT NULL DEFAULT 0,
  used_org_ids uuid[] NOT NULL DEFAULT '{}',
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  CONSTRAINT client_onboarding_links_uses CHECK (max_uses BETWEEN 1 AND 100 AND uses >= 0)
);
CREATE INDEX IF NOT EXISTS client_onboarding_links_created_idx ON client_onboarding_links (created_at DESC);

DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aic_tenant') THEN
    EXECUTE 'REVOKE ALL ON client_onboarding_links FROM aic_tenant';
  END IF;
END $outer$;
