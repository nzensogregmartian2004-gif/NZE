ALTER TABLE "public"."payments" ADD COLUMN IF NOT EXISTS "beneficiary_account_number" varchar(30);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_beneficiary_account_idx" ON "public"."payments" USING btree ("beneficiary_account_number");
