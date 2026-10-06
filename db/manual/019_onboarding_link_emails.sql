-- 019_onboarding_link_emails.sql
--
-- Client onboarding links are emailed by AIC itself, from aiccertified.cloud,
-- rather than pasted into someone's own email, so the client receives them
-- from a recognisable sender. Each send is recorded: to whom, by whom, when,
-- and whether the mail service accepted it.
--
-- AIC's own table: no row-level policy, withheld from aic_tenant.
-- Additive and safe to run more than once.

CREATE TABLE IF NOT EXISTS client_onboarding_link_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES client_onboarding_links(id) ON DELETE CASCADE,
  sent_to varchar(255) NOT NULL,
  sent_by uuid REFERENCES users(id) ON DELETE SET NULL,
  accepted boolean NOT NULL,
  failure varchar(40),
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_onboarding_link_emails_link_idx ON client_onboarding_link_emails (link_id, sent_at DESC);

DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aic_tenant') THEN
    EXECUTE 'REVOKE ALL ON client_onboarding_link_emails FROM aic_tenant';
  END IF;
END $outer$;
