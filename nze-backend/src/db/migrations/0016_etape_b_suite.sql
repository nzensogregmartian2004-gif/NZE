ALTER TABLE "entreprises" ADD COLUMN IF NOT EXISTS "nom_officiel" text;--> statement-breakpoint
ALTER TABLE "entreprises" ADD COLUMN IF NOT EXISTS "responsable_nom" text;--> statement-breakpoint
ALTER TABLE "entreprises" ADD COLUMN IF NOT EXISTS "responsable_role" text;--> statement-breakpoint
ALTER TABLE "entreprises" ADD COLUMN IF NOT EXISTS "responsable_telephone" text;--> statement-breakpoint
ALTER TABLE "entreprises" ADD COLUMN IF NOT EXISTS "telephone" text;--> statement-breakpoint
ALTER TABLE "entreprises" ADD COLUMN IF NOT EXISTS "email" text;--> statement-breakpoint
ALTER TABLE "commissions_regles" ADD COLUMN IF NOT EXISTS "date_fin" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "commissions_regles" ADD COLUMN IF NOT EXISTS "duree_mois" integer;--> statement-breakpoint
ALTER TABLE "commissions_regles" ADD COLUMN IF NOT EXISTS "conditions" text;--> statement-breakpoint
ALTER TABLE "commissions_regles" ADD COLUMN IF NOT EXISTS "document_url" text;--> statement-breakpoint
ALTER TABLE "stock_niveaux" ADD COLUMN IF NOT EXISTS "etat" text NOT NULL DEFAULT 'DISPONIBLE';--> statement-breakpoint
ALTER TABLE "stock_niveaux" ADD CONSTRAINT "stock_etat_chk" CHECK ("etat" IN ('DISPONIBLE','COLLECTE','INDISPONIBLE','A_CONFIRMER'));--> statement-breakpoint
ALTER TABLE "ecritures" ADD COLUMN IF NOT EXISTS "registre" text NOT NULL DEFAULT 'PARTENAIRE';--> statement-breakpoint
UPDATE "ecritures" SET "registre" = 'COMMISSIONS' WHERE "categorie" IN ('COMMISSION','FRAIS_LIVRAISON');--> statement-breakpoint
ALTER TABLE "ecritures" DROP CONSTRAINT IF EXISTS "ecriture_categorie_chk";--> statement-breakpoint
ALTER TABLE "ecritures" ADD CONSTRAINT "ecriture_categorie_chk" CHECK ("categorie" IN ('VENTE_NET','COMMISSION','FRAIS_LIVRAISON','ENCAISSEMENT'));--> statement-breakpoint
ALTER TABLE "ecritures" ADD CONSTRAINT "ecriture_registre_chk" CHECK ("registre" IN ('CLIENT','COMMISSIONS','PARTENAIRE'));
