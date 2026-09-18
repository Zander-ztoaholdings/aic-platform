-- 007_signup_profile.sql
--
-- The extended organisation profile captured at registration.
--
-- Registration used to record four things: a name, a Division, a standard
-- version and an admin user. That is enough to generate a requirement set and
-- nothing else — no jurisdiction, no sector, no sense of what the organisation
-- actually runs. Every one of those had to be asked for again later, by hand,
-- which is why most of them were never asked at all.
--
-- `affects_individuals` and `solely_automated` are the two conditions POPIA
-- Section 71 turns on. They are stored as text ('Yes' / 'No' / 'Not sure')
-- rather than booleans because "not sure" is a real and common answer at
-- registration, and a null that could mean either "unanswered" or "no" is
-- worthless to an assessor.
--
-- Additive and fully guarded — safe to run against production more than once.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS legal_name           varchar(255);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS registration_number   varchar(100);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS website               varchar(255);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS country               varchar(100);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sector                varchar(100);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS size_band             varchar(50);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS ai_systems_band       varchar(30);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS affects_individuals   varchar(20);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS solely_automated      varchar(20);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS referral_source       varchar(100);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS signup_completed_at   timestamptz;

ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title             varchar(150);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_accountable_person boolean DEFAULT false;

-- Sector and jurisdiction are the two fields any cohort or regulator-facing
-- view will group by, so they get indexes now rather than after the first
-- slow query.
CREATE INDEX IF NOT EXISTS organizations_country_idx ON organizations (country);
CREATE INDEX IF NOT EXISTS organizations_sector_idx  ON organizations (sector);
