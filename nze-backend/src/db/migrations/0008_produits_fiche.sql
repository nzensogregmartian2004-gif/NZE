ALTER TABLE "produits" ADD COLUMN "caracteristiques" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "produits" ADD COLUMN "photos" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "produits" ADD COLUMN "commentaires" text;