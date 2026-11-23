-- Étape 15 : tutoriels, préférences de notifications et centre d'aide/support.
CREATE TABLE IF NOT EXISTS "user_tutorial_progress" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "guide_key" varchar(60) NOT NULL,
  "status" varchar(16) NOT NULL DEFAULT 'started',
  "current_step" integer NOT NULL DEFAULT 0,
  "completed_at" timestamptz,
  "skipped_at" timestamptz,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "user_tutorial_progress_status_chk" CHECK ("status" IN ('started', 'skipped', 'completed')),
  CONSTRAINT "user_tutorial_progress_step_chk" CHECK ("current_step" >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_tutorial_progress_user_guide_uq" ON "user_tutorial_progress" ("user_id", "guide_key");
CREATE INDEX IF NOT EXISTS "user_tutorial_progress_user_updated_idx" ON "user_tutorial_progress" ("user_id", "updated_at");

CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "in_app_enabled" boolean NOT NULL DEFAULT true,
  "order_updates" boolean NOT NULL DEFAULT true,
  "delivery_updates" boolean NOT NULL DEFAULT true,
  "payment_updates" boolean NOT NULL DEFAULT true,
  "booking_updates" boolean NOT NULL DEFAULT true,
  "service_updates" boolean NOT NULL DEFAULT true,
  "reviews_reports_updates" boolean NOT NULL DEFAULT true,
  "marketing_updates" boolean NOT NULL DEFAULT false,
  "system_updates" boolean NOT NULL DEFAULT true,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "support_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "subject" varchar(120) NOT NULL,
  "category" varchar(40) NOT NULL,
  "message" text NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'ouvert',
  "resolution" text,
  "handled_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "support_requests_category_chk" CHECK ("category" IN ('compte', 'commande', 'paiement', 'livraison', 'reservation', 'prestation', 'signalement', 'autre')),
  CONSTRAINT "support_requests_status_chk" CHECK ("status" IN ('ouvert', 'en_cours', 'resolu', 'ferme'))
);
CREATE INDEX IF NOT EXISTS "support_requests_user_created_idx" ON "support_requests" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "support_requests_status_created_idx" ON "support_requests" ("status", "created_at");
