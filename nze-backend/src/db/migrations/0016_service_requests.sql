DO $$ BEGIN
  CREATE TYPE "service_request_status" AS ENUM ('recu', 'acceptee', 'refusee', 'en_cours', 'terminee', 'annulee');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "service_profiles"
  ADD COLUMN IF NOT EXISTS "nombre_vues" integer NOT NULL DEFAULT 0;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_profiles_nombre_vues_nonnegative_chk') THEN
    ALTER TABLE "service_profiles" ADD CONSTRAINT "service_profiles_nombre_vues_nonnegative_chk"
      CHECK ("nombre_vues" >= 0);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "service_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "service_profile_id" uuid NOT NULL REFERENCES "service_profiles"("id") ON DELETE CASCADE,
  "client_activity_id" uuid NOT NULL REFERENCES "user_activities"("id") ON DELETE CASCADE,
  "description" text NOT NULL,
  "date_souhaitee" timestamptz,
  "date_confirmee" timestamptz,
  "lieu_intervention" varchar(255),
  "budget_indicatif" numeric(12,2),
  "prix_accepte" numeric(12,2),
  "commentaire_prestataire" text,
  "statut" service_request_status NOT NULL DEFAULT 'recu',
  "cree_le" timestamptz NOT NULL DEFAULT now(),
  "maj_le" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "service_requests_budget_nonnegative_chk" CHECK ("budget_indicatif" IS NULL OR "budget_indicatif" >= 0),
  CONSTRAINT "service_requests_price_nonnegative_chk" CHECK ("prix_accepte" IS NULL OR "prix_accepte" >= 0)
);

CREATE INDEX IF NOT EXISTS "service_requests_profile_status_idx" ON "service_requests" ("service_profile_id", "statut");
CREATE INDEX IF NOT EXISTS "service_requests_client_created_idx" ON "service_requests" ("client_activity_id", "cree_le");
CREATE INDEX IF NOT EXISTS "service_requests_confirmed_date_idx" ON "service_requests" ("date_confirmee");
