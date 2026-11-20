CREATE TABLE "affectations_versement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"versement_id" uuid NOT NULL,
	"echeance_id" uuid,
	"penalite_id" uuid,
	"montant_fcfa" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "affectation_cible_chk" CHECK (("affectations_versement"."echeance_id" is null) <> ("affectations_versement"."penalite_id" is null))
);
--> statement-breakpoint
CREATE TABLE "echeances_mois" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"echeancier_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"montant_du_fcfa" integer NOT NULL,
	"montant_paye_fcfa" integer DEFAULT 0 NOT NULL,
	"date_limite" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "echeance_mois_chk" CHECK ("echeances_mois"."numero" >= 1 and "echeances_mois"."montant_du_fcfa" >= 0 and "echeances_mois"."montant_paye_fcfa" >= 0)
);
--> statement-breakpoint
CREATE TABLE "penalites_echeancier" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"echeancier_id" uuid NOT NULL,
	"mois_retard" integer NOT NULL,
	"montant_fcfa" integer NOT NULL,
	"montant_paye_fcfa" integer DEFAULT 0 NOT NULL,
	"appliquee_le" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "penalite_chk" CHECK ("penalites_echeancier"."mois_retard" >= 1 and "penalites_echeancier"."montant_fcfa" >= 0 and "penalites_echeancier"."montant_paye_fcfa" >= 0)
);
--> statement-breakpoint
ALTER TABLE "versements_echelonnes" ADD COLUMN "echeancier_id" uuid;--> statement-breakpoint
ALTER TABLE "affectations_versement" ADD CONSTRAINT "affectations_versement_versement_id_versements_echelonnes_id_fk" FOREIGN KEY ("versement_id") REFERENCES "public"."versements_echelonnes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affectations_versement" ADD CONSTRAINT "affectations_versement_echeance_id_echeances_mois_id_fk" FOREIGN KEY ("echeance_id") REFERENCES "public"."echeances_mois"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affectations_versement" ADD CONSTRAINT "affectations_versement_penalite_id_penalites_echeancier_id_fk" FOREIGN KEY ("penalite_id") REFERENCES "public"."penalites_echeancier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "echeances_mois" ADD CONSTRAINT "echeances_mois_echeancier_id_echeanciers_articles_id_fk" FOREIGN KEY ("echeancier_id") REFERENCES "public"."echeanciers_articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "penalites_echeancier" ADD CONSTRAINT "penalites_echeancier_echeancier_id_echeanciers_articles_id_fk" FOREIGN KEY ("echeancier_id") REFERENCES "public"."echeanciers_articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "versements_echelonnes" ADD CONSTRAINT "versements_echelonnes_echeancier_id_echeanciers_articles_id_fk" FOREIGN KEY ("echeancier_id") REFERENCES "public"."echeanciers_articles"("id") ON DELETE no action ON UPDATE no action;