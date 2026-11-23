ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "conditions_version" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "conditions_acceptees_le" timestamp with time zone;
