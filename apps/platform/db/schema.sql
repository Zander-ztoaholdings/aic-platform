-- Spiral 1: The Foundation
-- Schema for AIC Pulse (POPIA Section 71 Compliance)
--
-- IMPORTANT: Tables are ordered to satisfy foreign key dependencies.
-- Users and organizations must be created before tables that reference them.

-- Enum types
CREATE TYPE tier_enum AS ENUM ('TIER_1', 'TIER_2', 'TIER_3');
CREATE TYPE audit_status AS ENUM ('PENDING', 'VERIFIED', 'FLAGGED');
CREATE TYPE user_role AS ENUM ('ADMIN', 'COMPLIANCE_OFFICER', 'AUDITOR', 'VIEWER');

-- =============================================================
-- Core tables (no foreign key dependencies)
-- =============================================================

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    tier tier_enum DEFAULT 'TIER_3',
    integrity_score INTEGER DEFAULT 0 CHECK (integrity_score BETWEEN 0 AND 100),
    is_alpha BOOLEAN DEFAULT FALSE,
    api_key VARCHAR(255), -- Hashed in production
    auditor_id UUID, -- Reference to a user with role 'AUDITOR' (added after users table)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'VIEWER',
    org_id UUID REFERENCES organizations(id),
    is_active BOOLEAN DEFAULT TRUE,
    is_super_admin BOOLEAN DEFAULT FALSE,
    permissions JSONB DEFAULT '{}', -- e.g., {"can_publish": true, "can_verify_audit": false}
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================
-- Tables that depend on organizations and/or users
-- =============================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id),
    system_name VARCHAR(255),
    event_type VARCHAR(255),
    details JSONB NOT NULL,
    status audit_status DEFAULT 'PENDING',
    metadata JSONB DEFAULT '{}',
    integrity_hash VARCHAR(64),
    previous_hash VARCHAR(64), -- Chain link to previous audit record
    signature TEXT, -- RSA-3072 cryptographic signature
    sequence_number INTEGER,   -- Position in the hash chain
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- CRM Tables
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    company VARCHAR(255),
    source VARCHAR(50) DEFAULT 'WEB', -- 'QUIZ', 'ALPHA_FORM'
    score INTEGER,
    status VARCHAR(50) DEFAULT 'NEW',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    score INTEGER NOT NULL,
    tier VARCHAR(50) NOT NULL,
    answers JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE alpha_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    company VARCHAR(255),
    use_case TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50), -- 'DOCUMENTATION', 'TECHNICAL', 'OVERSIGHT'
    status VARCHAR(50) DEFAULT 'PENDING', -- 'PENDING', 'SUBMITTED', 'VERIFIED', 'REJECTED'
    evidence_url TEXT,
    findings TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255),
    message TEXT,
    type VARCHAR(50), -- 'WELCOME', 'AUDIT_UPDATE', 'ALERT', 'CERTIFIED'
    status VARCHAR(50) DEFAULT 'UNREAD', -- 'UNREAD', 'READ'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE compliance_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    month_year VARCHAR(20) NOT NULL, -- e.g., 'Jan 2026'
    integrity_score INTEGER NOT NULL,
    audit_status VARCHAR(50) DEFAULT 'COMPLIANT',
    findings_count INTEGER DEFAULT 0,
    report_url TEXT, -- Path to generated PDF
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- CMS Tables for HQ
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    excerpt TEXT,
    content TEXT, -- Markdown or HTML
    category VARCHAR(50),
    author_id UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'DRAFT', -- 'DRAFT', 'PUBLISHED', 'ARCHIVED'
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE newsletter_subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE', -- 'ACTIVE', 'UNSUBSCRIBED'
    subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE security_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id),
    action VARCHAR(255) NOT NULL, -- e.g., 'VERIFIED_REQUIREMENT', 'PUBLISHED_POST'
    entity_id UUID, -- ID of the requirement, post, or organization
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    citizen_email VARCHAR(255) NOT NULL,
    system_name VARCHAR(255),
    description TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'OPEN', -- 'OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'
    resolution_details TEXT,
    human_reviewer_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- API Keys for programmatic access (single table — merged from duplicate definitions)
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(12) NOT NULL, -- For display: aic_live_xxxx
    label VARCHAR(255), -- e.g., 'CI/CD Production'
    scopes TEXT[] DEFAULT ARRAY['read'],
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Session & Auth Tables
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Internal Operations Tables

CREATE TABLE performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    audits_completed INTEGER DEFAULT 0,
    qc_pass_rate DECIMAL(5,2) DEFAULT 0.00,
    average_response_time DECIMAL(10,2), -- in hours
    institutional_score INTEGER DEFAULT 0, -- internal ranking
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

CREATE TABLE operations_qc (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL, -- ID of the requirement or report being QC'd
    entity_type VARCHAR(50) NOT NULL, -- 'REQUIREMENT', 'REPORT'
    original_auditor_id UUID REFERENCES users(id),
    qc_reviewer_id UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'PENDING', -- 'PENDING', 'PASSED', 'REJECTED'
    findings TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE training_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    module_id VARCHAR(100) NOT NULL, -- e.g., 'legal-71', 'tech-bias'
    status VARCHAR(50) DEFAULT 'IN_PROGRESS', -- 'IN_PROGRESS', 'COMPLETED'
    score INTEGER,
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, module_id)
);

CREATE TABLE lead_auditor_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    certificate_id VARCHAR(100) UNIQUE NOT NULL,
    issue_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expiry_date TIMESTAMP WITH TIME ZONE,
    verification_hash VARCHAR(64) NOT NULL, -- SHA-256 of the certificate metadata
    status VARCHAR(50) DEFAULT 'ACTIVE', -- 'ACTIVE', 'REVOKED', 'EXPIRED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Scheduled Audits (audit scheduling workflow)
CREATE TABLE scheduled_audits (
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

-- =============================================================
-- Indexes for performance
-- =============================================================
CREATE INDEX idx_performance_user ON performance_metrics(user_id);
CREATE INDEX idx_qc_status ON operations_qc(status);
CREATE INDEX idx_training_user ON training_progress(user_id);
CREATE INDEX idx_creds_user ON lead_auditor_credentials(user_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_org ON users(org_id);
CREATE INDEX idx_audit_logs_org ON audit_logs(org_id);
CREATE INDEX idx_audit_logs_status ON audit_logs(status);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_sequence ON audit_logs(org_id, sequence_number);
CREATE INDEX idx_scheduled_audits_org ON scheduled_audits(org_id);
CREATE INDEX idx_scheduled_audits_status ON scheduled_audits(status);
CREATE INDEX idx_scheduled_audits_date ON scheduled_audits(scheduled_date);

-- =============================================================
-- Seed data has been moved to db/seed.sql.
-- Run schema.sql first, then seed.sql for development data.
-- NEVER run seed.sql in production.
-- =============================================================
