ALTER TABLE "users" ADD COLUMN "conditions_version" varchar(20);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "conditions_acceptees_le" timestamp with time zone;