-- =============================================================
-- AIC Platform — Development Seed Data
-- =============================================================
--
-- WARNING: This file contains demo credentials and test data.
-- NEVER run this in production.
--
-- Usage:
--   psql -U aic_admin -d aic_platform -f apps/platform/db/schema.sql
--   psql -U aic_admin -d aic_platform -f apps/platform/db/seed.sql
-- =============================================================

-- Demo Organization
INSERT INTO organizations (id, name, tier, integrity_score, is_alpha, api_key)
VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'FirstRand Bank (Demo)', 'TIER_1', 94, TRUE, 'aic_live_demo_key_123')
ON CONFLICT (id) DO NOTHING;

-- Demo User (password: demo123)
-- Generate a real hash with: npx bcryptjs 'your-password'
INSERT INTO users (id, email, password_hash, name, role, org_id)
VALUES (
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    'admin@enterprise.co.za',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    'Dr. Sarah Khumalo',
    'ADMIN',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
)
ON CONFLICT (id) DO NOTHING;

-- Demo Audit Requirements
INSERT INTO audit_requirements (org_id, title, description, category, status)
VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'POPIA Section 71 Policy', 'Formal document outlining human intervention procedures for automated decisions.', 'DOCUMENTATION', 'VERIFIED'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Model Bias Stress Test', 'Technical report proving four-fifths rule compliance across gender and race.', 'TECHNICAL', 'SUBMITTED'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Human-in-the-Loop Interface', 'UI walk-through showing the manual override button for loan officers.', 'OVERSIGHT', 'PENDING'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Data Sovereignty Proof', 'Verification that AI production data remains within South African borders.', 'TECHNICAL', 'PENDING');

-- Demo Compliance Reports
INSERT INTO compliance_reports (org_id, month_year, integrity_score, audit_status, findings_count)
VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Dec 2025', 92, 'COMPLIANT', 0),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Jan 2026', 94, 'COMPLIANT', 1);
