CREATE TABLE "audit_signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid,
	"auditor_id" uuid,
	"signature" text NOT NULL,
	"public_key" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "compliance_reports" ADD COLUMN "is_finalized" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "audit_signatures" ADD CONSTRAINT "audit_signatures_report_id_compliance_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."compliance_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_signatures" ADD CONSTRAINT "audit_signatures_auditor_id_users_id_fk" FOREIGN KEY ("auditor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;