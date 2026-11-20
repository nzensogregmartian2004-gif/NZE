-- Étape 13 : abonnements, promotions payantes et mises en avant éditoriales.
-- La campagne payante et la mise en avant éditoriale sont conservées dans des tables distinctes.

ALTER TYPE "public"."subscription_status" ADD VALUE IF NOT EXISTS 'en_attente_paiement';
ALTER TYPE "public"."ad_target_type" ADD VALUE IF NOT EXISTS 'hebergement';
DO $$ BEGIN
  CREATE TYPE "public"."advertisement_event_type" AS ENUM ('impression', 'clic', 'commande');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

UPDATE "subscription_plans" SET "fonctionnalites" = '[]'::jsonb WHERE "fonctionnalites" IS NULL;
ALTER TABLE "subscription_plans"
  ADD COLUMN IF NOT EXISTS "maj_le" timestamptz NOT NULL DEFAULT now(),
  ALTER COLUMN "fonctionnalites" SET DEFAULT '[]'::jsonb,
  ALTER COLUMN "fonctionnalites" SET NOT NULL;
ALTER TABLE "subscriptions"
  ALTER COLUMN "expire_le" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "debut_le" timestamptz,
  ADD COLUMN IF NOT EXISTS "payment_id" uuid,
  ADD COLUMN IF NOT EXISTS "pending_activity_id" uuid,
  ADD COLUMN IF NOT EXISTS "rappel_7j_envoye" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "rappel_1j_envoye" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "expiration_notifiee" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "maj_le" timestamptz NOT NULL DEFAULT now();
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_payment_id_payments_id_fk' AND conrelid = 'public.subscriptions'::regclass) THEN
    ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_payment_id_payments_id_fk"
      FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "subscriptions_activity_created_idx" ON "subscriptions" ("user_activity_id", "cree_le");
CREATE INDEX IF NOT EXISTS "subscriptions_payment_id_idx" ON "subscriptions" ("payment_id");
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_pending_activity_uq" ON "subscriptions" ("pending_activity_id") WHERE "pending_activity_id" IS NOT NULL;

ALTER TABLE "advertisements"
  ADD COLUMN IF NOT EXISTS "owner_activity_id" uuid,
  ADD COLUMN IF NOT EXISTS "region" varchar(120),
  ADD COLUMN IF NOT EXISTS "paiement_statut" varchar(20) NOT NULL DEFAULT 'en_attente',
  ADD COLUMN IF NOT EXISTS "paiement_confirme_le" timestamptz,
  ADD COLUMN IF NOT EXISTS "impressions" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "clics" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "commandes_attribuees" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "raison_moderation" text,
  ADD COLUMN IF NOT EXISTS "validee_par" uuid,
  ADD COLUMN IF NOT EXISTS "validee_le" timestamptz,
  ADD COLUMN IF NOT EXISTS "maj_le" timestamptz NOT NULL DEFAULT now();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'advertisements_owner_activity_id_user_activities_id_fk' AND conrelid = 'public.advertisements'::regclass) THEN
    ALTER TABLE "advertisements" ADD CONSTRAINT "advertisements_owner_activity_id_user_activities_id_fk"
      FOREIGN KEY ("owner_activity_id") REFERENCES "user_activities"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'advertisements_validee_par_users_id_fk' AND conrelid = 'public.advertisements'::regclass) THEN
    ALTER TABLE "advertisements" ADD CONSTRAINT "advertisements_validee_par_users_id_fk"
      FOREIGN KEY ("validee_par") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;
END $$;

-- Rattache les anciennes promotions à leur activité propriétaire lorsque possible.
UPDATE "advertisements" a SET "owner_activity_id" = s."user_activity_id"
FROM "products" p JOIN "stores" s ON s."id" = p."store_id"
WHERE a."owner_activity_id" IS NULL AND a."cible_type"::text = 'produit' AND a."cible_id" = p."id";
UPDATE "advertisements" a SET "owner_activity_id" = s."user_activity_id"
FROM "stores" s
WHERE a."owner_activity_id" IS NULL AND a."cible_type"::text = 'magasin' AND a."cible_id" = s."id";
UPDATE "advertisements" a SET "owner_activity_id" = p."user_activity_id"
FROM "service_profiles" p
WHERE a."owner_activity_id" IS NULL AND a."cible_type"::text = 'prestataire' AND a."cible_id" = p."id";
UPDATE "advertisements" a SET "owner_activity_id" = v."user_activity_id"
FROM "vehicles" v
WHERE a."owner_activity_id" IS NULL AND a."cible_type"::text = 'vehicule' AND a."cible_id" = v."id";
-- Les anciennes campagnes actives ne sont pas automatiquement considérées comme payées.
-- Elles restent masquées tant que leur paiement n'est pas réconcilié avec des données fournisseur.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'advertisements_payment_status_chk') THEN
    ALTER TABLE "advertisements" ADD CONSTRAINT "advertisements_payment_status_chk"
      CHECK ("paiement_statut" IN ('en_attente', 'confirme', 'echoue', 'incertain'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'advertisements_stats_nonnegative_chk') THEN
    ALTER TABLE "advertisements" ADD CONSTRAINT "advertisements_stats_nonnegative_chk"
      CHECK ("impressions" >= 0 AND "clics" >= 0 AND "commandes_attribuees" >= 0);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "advertisements_active_placement_idx" ON "advertisements" ("statut", "paiement_statut", "emplacement", "date_debut", "date_fin");
CREATE INDEX IF NOT EXISTS "advertisements_owner_created_idx" ON "advertisements" ("owner_activity_id", "cree_le");

CREATE TABLE IF NOT EXISTS "advertisement_pricing" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "cible_type" "ad_target_type" NOT NULL,
  "emplacement" varchar(100) NOT NULL,
  "prix_par_jour" numeric(12,2) NOT NULL,
  "devise" varchar(3) NOT NULL DEFAULT 'XAF',
  CONSTRAINT "advertisement_pricing_prix_par_jour_chk" CHECK ("prix_par_jour" > 0),
  CONSTRAINT "advertisement_pricing_devise_chk" CHECK ("devise" = 'XAF'),
  "actif" boolean NOT NULL DEFAULT true,
  "cree_le" timestamptz NOT NULL DEFAULT now(),
  "maj_le" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "advertisement_pricing_target_placement_uq" ON "advertisement_pricing" ("cible_type", "emplacement");

CREATE TABLE IF NOT EXISTS "advertisement_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "advertisement_id" uuid NOT NULL,
  "type" "advertisement_event_type" NOT NULL,
  "event_key" varchar(80) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "advertisement_events_advertisement_id_advertisements_id_fk"
    FOREIGN KEY ("advertisement_id") REFERENCES "advertisements"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "advertisement_events_ad_event_key_uq" ON "advertisement_events" ("advertisement_id", "event_key");
CREATE INDEX IF NOT EXISTS "advertisement_events_ad_created_idx" ON "advertisement_events" ("advertisement_id", "created_at");

CREATE TABLE IF NOT EXISTS "editorial_features" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "cible_type" "ad_target_type" NOT NULL,
  "cible_id" uuid NOT NULL,
  "emplacement" varchar(100) NOT NULL,
  "libelle" varchar(120) NOT NULL DEFAULT 'Mis en avant par NZE',
  "ordre" integer NOT NULL DEFAULT 0,
  "date_debut" date NOT NULL,
  "date_fin" date NOT NULL,
  "actif" boolean NOT NULL DEFAULT true,
  "cree_par" uuid,
  "cree_le" timestamptz NOT NULL DEFAULT now(),
  "maj_le" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "editorial_features_cree_par_users_id_fk"
    FOREIGN KEY ("cree_par") REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "editorial_features_order_nonnegative_chk" CHECK ("ordre" >= 0),
  CONSTRAINT "editorial_features_date_chk" CHECK ("date_fin" >= "date_debut")
);
CREATE INDEX IF NOT EXISTS "editorial_features_public_placement_idx" ON "editorial_features" ("actif", "emplacement", "date_debut", "date_fin", "ordre");
