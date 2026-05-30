-- Enable RLS on all tenant-specific tables
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incidents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scheduled_audits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "models" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_requirements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "compliance_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "decision_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "correction_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "api_keys" ENABLE ROW LEVEL SECURITY;

-- 1. Organizations Policy: Can only see your own organization
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'organization_isolation_policy') THEN
        CREATE POLICY organization_isolation_policy ON "organizations"
        USING (id = NULLIF(current_setting('app.current_org_id', TRUE), '')::uuid);
    END IF;
END $$;

-- 2. Users Policy: Can only see users in your organization
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'user_isolation_policy') THEN
        CREATE POLICY user_isolation_policy ON "users"
        USING (org_id = NULLIF(current_setting('app.current_org_id', TRUE), '')::uuid);
    END IF;
END $$;

-- 3. Generic Tenant Isolation Policy for all other tables
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'audit_logs_isolation_policy') THEN
        CREATE POLICY audit_logs_isolation_policy ON "audit_logs" USING (org_id = NULLIF(current_setting('app.current_org_id', TRUE), '')::uuid);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'incidents_isolation_policy') THEN
        CREATE POLICY incidents_isolation_policy ON "incidents" USING (org_id = NULLIF(current_setting('app.current_org_id', TRUE), '')::uuid);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'scheduled_audits_isolation_policy') THEN
        CREATE POLICY scheduled_audits_isolation_policy ON "scheduled_audits" USING (org_id = NULLIF(current_setting('app.current_org_id', TRUE), '')::uuid);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'models_isolation_policy') THEN
        CREATE POLICY models_isolation_policy ON "models" USING (org_id = NULLIF(current_setting('app.current_org_id', TRUE), '')::uuid);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'audit_requirements_isolation_policy') THEN
        CREATE POLICY audit_requirements_isolation_policy ON "audit_requirements" USING (org_id = NULLIF(current_setting('app.current_org_id', TRUE), '')::uuid);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'notifications_isolation_policy') THEN
        CREATE POLICY notifications_isolation_policy ON "notifications" USING (org_id = NULLIF(current_setting('app.current_org_id', TRUE), '')::uuid);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'compliance_reports_isolation_policy') THEN
        CREATE POLICY compliance_reports_isolation_policy ON "compliance_reports" USING (org_id = NULLIF(current_setting('app.current_org_id', TRUE), '')::uuid);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'decision_records_isolation_policy') THEN
        CREATE POLICY decision_records_isolation_policy ON "decision_records" USING (org_id = NULLIF(current_setting('app.current_org_id', TRUE), '')::uuid);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'correction_requests_isolation_policy') THEN
        CREATE POLICY correction_requests_isolation_policy ON "correction_requests" USING (org_id = NULLIF(current_setting('app.current_org_id', TRUE), '')::uuid);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'api_keys_isolation_policy') THEN
        CREATE POLICY api_keys_isolation_policy ON "api_keys" USING (org_id = NULLIF(current_setting('app.current_org_id', TRUE), '')::uuid);
    END IF;
END $$;
