ALTER TABLE "stores"
  ADD COLUMN IF NOT EXISTS "type_etablissement" varchar(20) NOT NULL DEFAULT 'commerce';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stores_type_etablissement_chk') THEN
    ALTER TABLE "stores" ADD CONSTRAINT "stores_type_etablissement_chk"
      CHECK ("type_etablissement" IN ('commerce', 'restaurant'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "restaurant_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "type_cuisine" varchar(100) NOT NULL DEFAULT 'Cuisine variée',
  "description" text,
  "telephone" varchar(40),
  "temps_preparation_moyen" integer NOT NULL DEFAULT 20 CHECK ("temps_preparation_moyen" BETWEEN 1 AND 240),
  "commandes_actives" boolean NOT NULL DEFAULT true,
  "montant_minimum" numeric(12,2) NOT NULL DEFAULT 0 CHECK ("montant_minimum" >= 0),
  "cree_le" timestamptz NOT NULL DEFAULT now(),
  "maj_le" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "restaurant_menu_sections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "nom" varchar(100) NOT NULL,
  "description" varchar(500),
  "ordre" integer NOT NULL DEFAULT 0,
  "actif" boolean NOT NULL DEFAULT true,
  "cree_le" timestamptz NOT NULL DEFAULT now(),
  "maj_le" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "restaurant_dish_details" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "section_id" uuid REFERENCES "restaurant_menu_sections"("id") ON DELETE SET NULL,
  "temps_preparation_minutes" integer NOT NULL DEFAULT 15 CHECK ("temps_preparation_minutes" BETWEEN 1 AND 240),
  "ingredients" text,
  "allergenes" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "option_groups" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "gestion_stock" boolean NOT NULL DEFAULT false,
  "mis_en_avant" boolean NOT NULL DEFAULT false,
  "cree_le" timestamptz NOT NULL DEFAULT now(),
  "maj_le" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "order_items"
  ADD COLUMN IF NOT EXISTS "options" jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "temps_preparation_estime_minutes" integer;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_prep_time_chk') THEN
    ALTER TABLE "orders" ADD CONSTRAINT "orders_prep_time_chk"
      CHECK ("temps_preparation_estime_minutes" IS NULL OR "temps_preparation_estime_minutes" BETWEEN 1 AND 240);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "restaurant_profiles_store_id_uq" ON "restaurant_profiles" ("store_id");
CREATE UNIQUE INDEX IF NOT EXISTS "restaurant_dish_details_product_id_uq" ON "restaurant_dish_details" ("product_id");
CREATE UNIQUE INDEX IF NOT EXISTS "restaurant_menu_sections_store_name_uq" ON "restaurant_menu_sections" ("store_id", "nom");
CREATE INDEX IF NOT EXISTS "restaurant_menu_sections_store_order_idx"
  ON "restaurant_menu_sections" ("store_id", "ordre");
CREATE INDEX IF NOT EXISTS "restaurant_dish_details_section_idx"
  ON "restaurant_dish_details" ("section_id");
CREATE INDEX IF NOT EXISTS "orders_store_created_idx" ON "orders" ("store_id", "cree_le");
