ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "checkout_group_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "idempotency_key" varchar(100);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "orders_client_activity_id_idempotency_key_uq"
  ON "orders" ("client_activity_id", "idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_checkout_group_id_idx" ON "orders" ("checkout_group_id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_status_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL,
  "from_status" "public"."order_status",
  "to_status" "public"."order_status" NOT NULL,
  "changed_by_user_id" uuid,
  "note" text,
  "cree_le" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_orders_id_fk"
    FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_changed_by_user_id_users_id_fk"
    FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_status_history_order_created_idx"
  ON "order_status_history" ("order_id", "cree_le");
