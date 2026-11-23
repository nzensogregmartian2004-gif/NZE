ALTER TYPE "public"."payment_type" ADD VALUE IF NOT EXISTS 'commande';--> statement-breakpoint
ALTER TYPE "public"."payment_status" ADD VALUE IF NOT EXISTS 'incertain';--> statement-breakpoint
ALTER TABLE "public"."payments" ADD COLUMN IF NOT EXISTS "provider" varchar(30);--> statement-breakpoint
ALTER TABLE "public"."payments" ADD COLUMN IF NOT EXISTS "merchant_reference" varchar(100);--> statement-breakpoint
ALTER TABLE "public"."payments" ADD COLUMN IF NOT EXISTS "provider_reference" varchar(100);--> statement-breakpoint
ALTER TABLE "public"."payments" ADD COLUMN IF NOT EXISTS "checkout_group_id" uuid;--> statement-breakpoint
ALTER TABLE "public"."payments" ADD COLUMN IF NOT EXISTS "operator_code" varchar(50);--> statement-breakpoint
ALTER TABLE "public"."payments" ADD COLUMN IF NOT EXISTS "provider_status" varchar(80);--> statement-breakpoint
ALTER TABLE "public"."payments" ADD COLUMN IF NOT EXISTS "provider_fees" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "public"."payments" ADD COLUMN IF NOT EXISTS "maj_le" timestamp with time zone NOT NULL DEFAULT now();--> statement-breakpoint
ALTER TABLE "public"."payments" ADD COLUMN IF NOT EXISTS "confirme_le" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payments_merchant_reference_uq" ON "public"."payments" USING btree ("merchant_reference") WHERE "merchant_reference" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payments_provider_reference_uq" ON "public"."payments" USING btree ("provider_reference") WHERE "provider_reference" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_checkout_group_id_idx" ON "public"."payments" USING btree ("checkout_group_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_user_created_idx" ON "public"."payments" USING btree ("user_id", "cree_le");
