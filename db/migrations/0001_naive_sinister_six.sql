CREATE TABLE "system_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" varchar(255) NOT NULL,
	"actor_id" uuid,
	"details" jsonb NOT NULL,
	"previous_hash" varchar(64),
	"integrity_hash" varchar(64) NOT NULL,
	"sequence_number" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "system_ledger" ADD CONSTRAINT "system_ledger_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;