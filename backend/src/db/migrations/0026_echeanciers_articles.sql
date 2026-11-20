CREATE TABLE "echeanciers_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"ligne_id" uuid NOT NULL,
	"produit_id" uuid NOT NULL,
	"prix_fcfa" integer NOT NULL,
	"avance_pourcent" integer NOT NULL,
	"avance_fcfa" integer NOT NULL,
	"reste_fcfa" integer NOT NULL,
	"duree_mois" integer NOT NULL,
	"mensualite_fcfa" integer NOT NULL,
	"dernier_mois_fcfa" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "echeancier_duree_chk" CHECK ("echeanciers_articles"."duree_mois" between 1 and 12),
	CONSTRAINT "echeancier_avance_chk" CHECK ("echeanciers_articles"."avance_pourcent" between 10 and 90),
	CONSTRAINT "echeancier_somme_chk" CHECK ("echeanciers_articles"."avance_fcfa" + "echeanciers_articles"."reste_fcfa" = "echeanciers_articles"."prix_fcfa"),
	CONSTRAINT "echeancier_mois_chk" CHECK (("echeanciers_articles"."duree_mois" - 1) * "echeanciers_articles"."mensualite_fcfa" + "echeanciers_articles"."dernier_mois_fcfa" = "echeanciers_articles"."reste_fcfa")
);
--> statement-breakpoint
ALTER TABLE "produits" ADD COLUMN "duree_mois" integer;--> statement-breakpoint
ALTER TABLE "produits" ADD COLUMN "avance_pourcent" integer;--> statement-breakpoint
ALTER TABLE "echeanciers_articles" ADD CONSTRAINT "echeanciers_articles_plan_id_plans_echelonnes_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans_echelonnes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "echeanciers_articles" ADD CONSTRAINT "echeanciers_articles_ligne_id_lignes_commande_id_fk" FOREIGN KEY ("ligne_id") REFERENCES "public"."lignes_commande"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "echeanciers_articles" ADD CONSTRAINT "echeanciers_articles_produit_id_produits_id_fk" FOREIGN KEY ("produit_id") REFERENCES "public"."produits"("id") ON DELETE no action ON UPDATE no action;