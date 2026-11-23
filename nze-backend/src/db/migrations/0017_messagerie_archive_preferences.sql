ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "masquee_pour_client_le" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "archivee_le" timestamp with time zone;--> statement-breakpoint
DROP INDEX IF EXISTS "conversations_user_produit_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_user_produit_idx" ON "conversations" ("user_id","produit_id") WHERE "masquee_pour_client_le" IS NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notif_messages_actives" boolean NOT NULL DEFAULT true;
