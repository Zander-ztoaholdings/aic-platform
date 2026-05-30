-- Migration: 002_add_scheduled_audits
-- Add scheduled_audits table for managing audit scheduling workflow

CREATE TABLE IF NOT EXISTS scheduled_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) NOT NULL,
    audit_type VARCHAR(50) NOT NULL DEFAULT 'QUARTERLY',
    status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED',
    assigned_auditor_id UUID REFERENCES users(id),
    scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    findings_count INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_audit_type CHECK (audit_type IN ('INITIAL', 'QUARTERLY', 'ANNUAL', 'INCIDENT', 'SPECIAL')),
    CONSTRAINT valid_audit_status CHECK (status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'OVERDUE'))
);

CREATE INDEX IF NOT EXISTS idx_scheduled_audits_org_id ON scheduled_audits(org_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_audits_status ON scheduled_audits(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_audits_scheduled_date ON scheduled_audits(scheduled_date);
