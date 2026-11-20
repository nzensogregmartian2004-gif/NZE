ALTER TABLE "public"."payments" ADD COLUMN IF NOT EXISTS "transaction_type" varchar(20) NOT NULL DEFAULT 'PAYMENT';--> statement-breakpoint
ALTER TABLE "public"."payments" ADD COLUMN IF NOT EXISTS "payment_service" varchar(32);--> statement-breakpoint
ALTER TABLE "public"."payments" ADD COLUMN IF NOT EXISTS "payment_link_url" varchar(2048);--> statement-breakpoint
ALTER TABLE "public"."payments" ADD COLUMN IF NOT EXISTS "parent_payment_id" uuid;--> statement-breakpoint
ALTER TABLE "public"."payments" ADD COLUMN IF NOT EXISTS "processed_by_user_id" uuid;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_parent_payment_id_payments_id_fk') THEN
    ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_parent_payment_id_payments_id_fk" FOREIGN KEY ("parent_payment_id") REFERENCES "public"."payments"("id") ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_processed_by_user_id_users_id_fk') THEN
    ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_processed_by_user_id_users_id_fk" FOREIGN KEY ("processed_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_transaction_type_check') THEN
    ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_transaction_type_check" CHECK ("transaction_type" IN ('PAYMENT', 'GIVE_CHANGE'));
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_parent_payment_id_idx" ON "public"."payments" USING btree ("parent_payment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_type_transaction_status_idx" ON "public"."payments" USING btree ("type", "transaction_type", "statut");
