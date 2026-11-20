ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "marque" varchar(100);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "modele" varchar(100);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "reference" varchar(100);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "etat" varchar(20) DEFAULT 'neuf' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "caracteristiques" jsonb;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "variantes" jsonb;--> statement-breakpoint

-- Catégories initiales du catalogue ; idempotent si certaines existent déjà.
INSERT INTO "categories" ("nom", "type")
SELECT seeds.nom, 'produit'::"category_type"
FROM (VALUES
  ('Électronique'),
  ('Informatique'),
  ('Téléphones et accessoires'),
  ('Mode et accessoires'),
  ('Maison et décoration'),
  ('Électroménager'),
  ('Beauté et soins'),
  ('Alimentation'),
  ('Sport et loisirs'),
  ('Pièces auto et moto'),
  ('Bricolage et quincaillerie'),
  ('Bébé et enfants')
) AS seeds(nom)
WHERE NOT EXISTS (
  SELECT 1 FROM "categories" existing
  WHERE lower(existing."nom") = lower(seeds.nom)
    AND existing."type" = 'produit'::"category_type"
);
