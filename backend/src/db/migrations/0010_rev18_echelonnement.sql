CREATE TABLE "plans_echelonnes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"commande_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"entreprise_id" uuid NOT NULL,
	"statut" text NOT NULL,
	"total_fcfa" integer NOT NULL,
	"avance_fcfa" integer NOT NULL,
	"reste_fcfa" integer NOT NULL,
	"mensualite_fcfa" integer NOT NULL,
	"nombre_articles" integer NOT NULL,
	"commercant_total_fcfa" integer NOT NULL,
	"commission_total_fcfa" integer NOT NULL,
	"livraison_total_fcfa" integer NOT NULL,
	"date_debut" timestamp with time zone,
	"motif_annulation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_echelonnes_commande_id_unique" UNIQUE("commande_id"),
	CONSTRAINT "plans_statut_chk" CHECK ("plans_echelonnes"."statut" in ('PROPOSE','ACTIF','SOLDE','ANNULE')),
	CONSTRAINT "plans_montants_chk" CHECK ("plans_echelonnes"."total_fcfa" > 0 and "plans_echelonnes"."reste_fcfa" > 0 and "plans_echelonnes"."mensualite_fcfa" > 0)
);
--> statement-breakpoint
CREATE TABLE "versements_echelonnes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"type" text NOT NULL,
	"montant_fcfa" integer NOT NULL,
	"statut" text NOT NULL,
	"commercant_fcfa" integer,
	"commission_fcfa" integer,
	"livraison_fcfa" integer,
	"encaisse_le" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "versements_type_chk" CHECK ("versements_echelonnes"."type" in ('AVANCE','VERSEMENT')),
	CONSTRAINT "versements_statut_chk" CHECK ("versements_echelonnes"."statut" in ('EN_ATTENTE','ENCAISSE','ECHEC')),
	CONSTRAINT "versements_montant_chk" CHECK ("versements_echelonnes"."montant_fcfa" > 0)
);
--> statement-breakpoint
ALTER TABLE "produits" ADD COLUMN "echelonnable" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "versement_id" uuid;--> statement-breakpoint
ALTER TABLE "plans_echelonnes" ADD CONSTRAINT "plans_echelonnes_commande_id_commandes_id_fk" FOREIGN KEY ("commande_id") REFERENCES "public"."commandes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans_echelonnes" ADD CONSTRAINT "plans_echelonnes_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans_echelonnes" ADD CONSTRAINT "plans_echelonnes_entreprise_id_entreprises_id_fk" FOREIGN KEY ("entreprise_id") REFERENCES "public"."entreprises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "versements_echelonnes" ADD CONSTRAINT "versements_echelonnes_plan_id_plans_echelonnes_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans_echelonnes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plans_client_idx" ON "plans_echelonnes" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "plans_entreprise_idx" ON "plans_echelonnes" USING btree ("entreprise_id");--> statement-breakpoint
CREATE INDEX "versements_plan_idx" ON "versements_echelonnes" USING btree ("plan_id");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_versement_id_versements_echelonnes_id_fk" FOREIGN KEY ("versement_id") REFERENCES "public"."versements_echelonnes"("id") ON DELETE no action ON UPDATE no action;