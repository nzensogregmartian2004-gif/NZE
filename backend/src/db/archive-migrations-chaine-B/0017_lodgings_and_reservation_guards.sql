-- Étape 12: hébergements et renforcement des réservations.
-- Les deux nouveaux rôles restent soumis à validation administrative par défaut.
ALTER TYPE "public"."activity_type" ADD VALUE IF NOT EXISTS 'hebergeur';
ALTER TYPE "public"."activity_type" ADD VALUE IF NOT EXISTS 'loueur';
ALTER TYPE "public"."review_target_type" ADD VALUE IF NOT EXISTS 'hebergement';

DO $$ BEGIN CREATE TYPE "public"."lodging_type" AS ENUM ('hotel','motel','auberge','maison_hotes','chambre','studio','appartement','maison','villa');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."lodging_validation_status" AS ENUM ('en_attente','valide','refuse','suspendu');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."lodging_booking_status" AS ENUM ('demandee','acceptee','refusee','terminee','annulee');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "note_moyenne" numeric(3,2);
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "nombre_avis" integer NOT NULL DEFAULT 0;
ALTER TABLE "vehicle_bookings" ADD COLUMN IF NOT EXISTS "prix_journalier_snapshot" numeric(12,2);
ALTER TABLE "vehicle_bookings" ADD COLUMN IF NOT EXISTS "montant_total" numeric(12,2);
ALTER TABLE "vehicle_bookings" ADD COLUMN IF NOT EXISTS "devise" varchar(3) NOT NULL DEFAULT 'XAF';
ALTER TABLE "vehicle_bookings" ADD COLUMN IF NOT EXISTS "raison_annulation" varchar(500);
ALTER TABLE "vehicle_bookings" ADD COLUMN IF NOT EXISTS "maj_le" timestamp with time zone NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS "lodgings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_activity_id" uuid NOT NULL REFERENCES "user_activities"("id") ON DELETE CASCADE,
  "type" "lodging_type" NOT NULL,
  "nom" varchar(160) NOT NULL,
  "description" text,
  "adresse" varchar(255) NOT NULL,
  "ville" varchar(120) NOT NULL,
  "quartier" varchar(120),
  "prix_par_nuit" numeric(12,2) NOT NULL,
  "capacite" integer NOT NULL DEFAULT 1,
  "chambres" integer,
  "salles_de_bain" integer,
  "equipements" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "heure_arrivee" varchar(5) NOT NULL DEFAULT '14:00',
  "heure_depart" varchar(5) NOT NULL DEFAULT '11:00',
  "regles" text,
  "latitude" double precision,
  "longitude" double precision,
  "disponible" boolean NOT NULL DEFAULT true,
  "statut_validation" "lodging_validation_status" NOT NULL DEFAULT 'en_attente',
  "nombre_vues" integer NOT NULL DEFAULT 0,
  "note_moyenne" numeric(3,2),
  "nombre_avis" integer NOT NULL DEFAULT 0,
  "cree_le" timestamp with time zone NOT NULL DEFAULT now(),
  "maj_le" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "lodgings_prix_positive_chk" CHECK ("prix_par_nuit" > 0),
  CONSTRAINT "lodgings_capacite_positive_chk" CHECK ("capacite" > 0),
  CONSTRAINT "lodgings_nombre_vues_nonnegative_chk" CHECK ("nombre_vues" >= 0),
  CONSTRAINT "lodgings_nombre_avis_nonnegative_chk" CHECK ("nombre_avis" >= 0)
);
CREATE INDEX IF NOT EXISTS "lodgings_owner_activity_idx" ON "lodgings" ("owner_activity_id");
CREATE INDEX IF NOT EXISTS "lodgings_public_search_idx" ON "lodgings" ("statut_validation", "disponible", "ville", "type");

CREATE TABLE IF NOT EXISTS "lodging_photos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lodging_id" uuid NOT NULL REFERENCES "lodgings"("id") ON DELETE CASCADE,
  "url" varchar(500) NOT NULL,
  "ordre" integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS "lodging_photos_lodging_idx" ON "lodging_photos" ("lodging_id");

CREATE TABLE IF NOT EXISTS "lodging_bookings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lodging_id" uuid NOT NULL REFERENCES "lodgings"("id") ON DELETE RESTRICT,
  "client_activity_id" uuid NOT NULL REFERENCES "user_activities"("id") ON DELETE RESTRICT,
  "date_debut" date NOT NULL,
  "date_fin" date NOT NULL,
  "nombre_voyageurs" integer NOT NULL DEFAULT 1,
  "prix_nuit_snapshot" numeric(12,2) NOT NULL,
  "montant_total" numeric(12,2) NOT NULL,
  "devise" varchar(3) NOT NULL DEFAULT 'XAF',
  "statut" "lodging_booking_status" NOT NULL DEFAULT 'demandee',
  "message" text,
  "raison_annulation" varchar(500),
  "cree_le" timestamp with time zone NOT NULL DEFAULT now(),
  "maj_le" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "lodging_bookings_dates_chk" CHECK ("date_fin" > "date_debut"),
  CONSTRAINT "lodging_bookings_guests_chk" CHECK ("nombre_voyageurs" > 0),
  CONSTRAINT "lodging_bookings_price_chk" CHECK ("prix_nuit_snapshot" > 0 AND "montant_total" > 0)
);
CREATE INDEX IF NOT EXISTS "lodging_bookings_lodging_status_idx" ON "lodging_bookings" ("lodging_id", "statut");
CREATE INDEX IF NOT EXISTS "lodging_bookings_client_created_idx" ON "lodging_bookings" ("client_activity_id", "cree_le");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicle_bookings_dates_chk') THEN
    ALTER TABLE "vehicle_bookings" ADD CONSTRAINT "vehicle_bookings_dates_chk" CHECK ("date_fin" > "date_debut");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicle_bookings_amount_positive_chk') THEN
    ALTER TABLE "vehicle_bookings" ADD CONSTRAINT "vehicle_bookings_amount_positive_chk" CHECK ("montant_total" IS NULL OR "montant_total" >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_nombre_avis_nonnegative_chk') THEN
    ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_nombre_avis_nonnegative_chk" CHECK ("nombre_avis" >= 0);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "vehicle_bookings_vehicle_status_idx" ON "vehicle_bookings" ("vehicle_id", "statut");
CREATE INDEX IF NOT EXISTS "vehicle_bookings_client_created_idx" ON "vehicle_bookings" ("client_activity_id", "cree_le");
