-- Étape 14 : administration, rôles internes, paramètres et audit.
DO $$ BEGIN
  CREATE TYPE "public"."admin_role" AS ENUM ('super_admin','moderation','support','finance','professionnels','livraisons');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "admin_role_assignments" (
  "user_id" uuid PRIMARY KEY NOT NULL,
  "role" "admin_role" NOT NULL,
  "assigned_by" uuid,
  "cree_le" timestamptz NOT NULL DEFAULT now(),
  "maj_le" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "admin_role_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "admin_role_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "admin_role_assignments_role_idx" ON "admin_role_assignments" ("role");

CREATE TABLE IF NOT EXISTS "platform_settings" (
  "key" varchar(100) PRIMARY KEY NOT NULL,
  "value" jsonb NOT NULL,
  "updated_by" uuid,
  "maj_le" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "platform_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL
);

ALTER TABLE "admin_actions" ADD COLUMN IF NOT EXISTS "details" jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS "admin_actions_created_idx" ON "admin_actions" ("cree_le");

-- Préserve l'accès des administrateurs déjà existants en leur attribuant le rôle complet.
INSERT INTO "admin_role_assignments" ("user_id", "role", "assigned_by")
SELECT "id", 'super_admin'::"admin_role", "id" FROM "users" WHERE "is_admin" = TRUE
ON CONFLICT ("user_id") DO NOTHING;

INSERT INTO "platform_settings" ("key", "value") VALUES
  ('maintenance_mode', 'false'::jsonb),
  ('orders_enabled', 'true'::jsonb),
  ('low_stock_threshold', '5'::jsonb),
  ('service_fee', '{"mode":"pourcentage","valeur":0,"devise":"XAF"}'::jsonb),
  ('support_contact', '{"email":"","telephone":""}'::jsonb)
ON CONFLICT ("key") DO NOTHING;
