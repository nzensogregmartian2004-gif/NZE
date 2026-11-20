ALTER TABLE "stores"
  ADD COLUMN IF NOT EXISTS "livraison_active" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "mode_livraison" varchar(20) NOT NULL DEFAULT 'nze',
  ADD COLUMN IF NOT EXISTS "retrait_active" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "rayon_livraison_km" double precision NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS "tarif_livraison_base" numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "tarif_livraison_km" numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "frais_livraison" numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "distance_livraison_km" double precision,
  ADD COLUMN IF NOT EXISTS "prestataire_livraison" varchar(20);

ALTER TABLE "deliveries"
  ADD COLUMN IF NOT EXISTS "distance_km" double precision,
  ADD COLUMN IF NOT EXISTS "frais_livraison" numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "preuve_type" varchar(20),
  ADD COLUMN IF NOT EXISTS "preuve_reference" text,
  ADD COLUMN IF NOT EXISTS "preuve_code_hash" varchar(64),
  ADD COLUMN IF NOT EXISTS "preuve_enregistree_le" timestamptz;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stores_mode_livraison_chk') THEN
    ALTER TABLE "stores" ADD CONSTRAINT "stores_mode_livraison_chk"
      CHECK ("mode_livraison" IN ('nze', 'propre', 'mixte'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stores_rayon_livraison_chk') THEN
    ALTER TABLE "stores" ADD CONSTRAINT "stores_rayon_livraison_chk"
      CHECK ("rayon_livraison_km" > 0 AND "rayon_livraison_km" <= 200);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stores_tarifs_livraison_chk') THEN
    ALTER TABLE "stores" ADD CONSTRAINT "stores_tarifs_livraison_chk"
      CHECK ("tarif_livraison_base" >= 0 AND "tarif_livraison_km" >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_prestataire_livraison_chk') THEN
    ALTER TABLE "orders" ADD CONSTRAINT "orders_prestataire_livraison_chk"
      CHECK ("prestataire_livraison" IS NULL OR "prestataire_livraison" IN ('nze', 'propre'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deliveries_preuve_type_chk') THEN
    ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_preuve_type_chk"
      CHECK ("preuve_type" IS NULL OR "preuve_type" IN ('code', 'signature', 'photo', 'autre'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "delivery_pricing_settings" (
  "id" smallint PRIMARY KEY CHECK ("id" = 1),
  "active" boolean NOT NULL DEFAULT false,
  "base_fee" numeric(12,2) NOT NULL DEFAULT 500 CHECK ("base_fee" >= 0),
  "fee_per_km" numeric(12,2) NOT NULL DEFAULT 100 CHECK ("fee_per_km" >= 0),
  "max_distance_km" double precision NOT NULL DEFAULT 30 CHECK ("max_distance_km" > 0 AND "max_distance_km" <= 200),
  "maj_le" timestamptz NOT NULL DEFAULT now()
);

INSERT INTO "delivery_pricing_settings" ("id", "active", "base_fee", "fee_per_km", "max_distance_km")
VALUES (1, false, 500, 100, 30)
ON CONFLICT ("id") DO NOTHING;

CREATE INDEX IF NOT EXISTS "deliveries_order_id_idx" ON "deliveries" ("order_id");
CREATE INDEX IF NOT EXISTS "deliveries_status_created_idx" ON "deliveries" ("statut", "cree_le");
