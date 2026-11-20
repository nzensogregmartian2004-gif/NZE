ALTER TABLE "entreprises" ADD COLUMN IF NOT EXISTS "statut_partenariat" text NOT NULL DEFAULT 'prospect';--> statement-breakpoint
UPDATE "entreprises" SET "statut_partenariat" = 'actif' WHERE "id" IN (SELECT "entreprise_id" FROM "commissions_regles");--> statement-breakpoint
ALTER TABLE "entreprises" ADD CONSTRAINT "entreprises_statut_chk" CHECK ("statut_partenariat" IN ('prospect','negociation','actif','suspendu','cloture'));
