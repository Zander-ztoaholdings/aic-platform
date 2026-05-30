CREATE TYPE "public"."audit_scheduled_status" AS ENUM('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."audit_status" AS ENUM('PENDING', 'VERIFIED', 'FLAGGED');--> statement-breakpoint
CREATE TYPE "public"."correction_status" AS ENUM('SUBMITTED', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."incident_status" AS ENUM('OPEN', 'INVESTIGATING', 'RESOLVED', 'DISMISSED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."tier_enum" AS ENUM('TIER_1', 'TIER_2', 'TIER_3');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'COMPLIANCE_OFFICER', 'AUDITOR', 'VIEWER');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"system_name" varchar(255),
	"event_type" varchar(255),
	"details" jsonb NOT NULL,
	"status" "audit_status" DEFAULT 'PENDING',
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"integrity_hash" varchar(64),
	"previous_hash" varchar(64),
	"sequence_number" integer,
	"signature" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"title" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(50),
	"status" varchar(50) DEFAULT 'PENDING',
	"evidence_url" text,
	"findings" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "compliance_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"month_year" varchar(20) NOT NULL,
	"integrity_score" integer NOT NULL,
	"audit_status" varchar(50) DEFAULT 'COMPLIANT',
	"findings_count" integer DEFAULT 0,
	"report_url" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "correction_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"decision_id" uuid,
	"citizen_email" varchar(255) NOT NULL,
	"reason" text NOT NULL,
	"supporting_evidence_url" text,
	"status" "correction_status" DEFAULT 'SUBMITTED',
	"resolution_details" text,
	"human_reviewer_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "decision_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"system_name" varchar(255) NOT NULL,
	"input_params" jsonb NOT NULL,
	"outcome" jsonb NOT NULL,
	"explanation" text,
	"integrity_hash" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"citizen_email" varchar(255) NOT NULL,
	"system_name" varchar(255),
	"description" text NOT NULL,
	"status" "incident_status" DEFAULT 'OPEN',
	"resolution_details" text,
	"human_reviewer_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"company" varchar(255),
	"source" varchar(50) DEFAULT 'WEB',
	"score" integer,
	"status" varchar(50) DEFAULT 'NEW',
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "leads_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"name" varchar(255) NOT NULL,
	"version" varchar(50) DEFAULT '1.0.0',
	"type" varchar(100),
	"description" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"title" varchar(255),
	"message" text,
	"type" varchar(50),
	"status" varchar(50) DEFAULT 'UNREAD',
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"tier" "tier_enum" DEFAULT 'TIER_3',
	"integrity_score" integer DEFAULT 0,
	"is_alpha" boolean DEFAULT false,
	"contact_email" varchar(255),
	"api_key" varchar(255),
	"auditor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "scheduled_audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"auditor_id" uuid,
	"scheduled_at" timestamp with time zone NOT NULL,
	"status" "audit_scheduled_status" DEFAULT 'SCHEDULED',
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"role" "user_role" DEFAULT 'VIEWER',
	"org_id" uuid,
	"is_active" boolean DEFAULT true,
	"email_verified" boolean DEFAULT false,
	"is_super_admin" boolean DEFAULT false,
	"permissions" jsonb DEFAULT '{}'::jsonb,
	"last_login" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_requirements" ADD CONSTRAINT "audit_requirements_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_reports" ADD CONSTRAINT "compliance_reports_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_decision_id_decision_records_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."decision_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_human_reviewer_id_users_id_fk" FOREIGN KEY ("human_reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_records" ADD CONSTRAINT "decision_records_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_human_reviewer_id_users_id_fk" FOREIGN KEY ("human_reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "models" ADD CONSTRAINT "models_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_audits" ADD CONSTRAINT "scheduled_audits_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_audits" ADD CONSTRAINT "scheduled_audits_auditor_id_users_id_fk" FOREIGN KEY ("auditor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;