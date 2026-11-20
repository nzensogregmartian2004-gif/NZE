CREATE TABLE "bordereaux" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"numero" integer GENERATED ALWAYS AS IDENTITY (sequence name "bordereaux_numero_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"entreprise_id" uuid NOT NULL,
	"etablissement_id" uuid,
	"collecteur_id" uuid NOT NULL,
	"statut" text NOT NULL,
	"commentaire" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bordereaux_statut_chk" CHECK ("bordereaux"."statut" in ('COLLECTE','ANOMALIE','ANNULE'))
);
--> statement-breakpoint
CREATE TABLE "journal_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"acteur_id" uuid,
	"action" text NOT NULL,
	"cible_type" text NOT NULL,
	"cible_id" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lignes_bordereau" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bordereau_id" uuid NOT NULL,
	"produit_id" uuid NOT NULL,
	"ligne_commande_id" uuid,
	"nom_article" text NOT NULL,
	"quantite" integer NOT NULL,
	"etat" text NOT NULL,
	"accessoires" text,
	"test_effectue" boolean DEFAULT false NOT NULL,
	"resultat_test" text,
	"controle" text NOT NULL,
	"commentaire" text,
	"bloque_livraison" boolean DEFAULT false NOT NULL,
	"motif_levee" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lignes_bordereau_quantite_chk" CHECK ("lignes_bordereau"."quantite" > 0),
	CONSTRAINT "lignes_bordereau_controle_chk" CHECK ("lignes_bordereau"."controle" in ('CONFORME','ANOMALIE'))
);
--> statement-breakpoint
ALTER TABLE "bordereaux" ADD CONSTRAINT "bordereaux_entreprise_id_entreprises_id_fk" FOREIGN KEY ("entreprise_id") REFERENCES "public"."entreprises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bordereaux" ADD CONSTRAINT "bordereaux_etablissement_id_etablissements_id_fk" FOREIGN KEY ("etablissement_id") REFERENCES "public"."etablissements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bordereaux" ADD CONSTRAINT "bordereaux_collecteur_id_users_id_fk" FOREIGN KEY ("collecteur_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_audit" ADD CONSTRAINT "journal_audit_acteur_id_users_id_fk" FOREIGN KEY ("acteur_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lignes_bordereau" ADD CONSTRAINT "lignes_bordereau_bordereau_id_bordereaux_id_fk" FOREIGN KEY ("bordereau_id") REFERENCES "public"."bordereaux"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lignes_bordereau" ADD CONSTRAINT "lignes_bordereau_produit_id_produits_id_fk" FOREIGN KEY ("produit_id") REFERENCES "public"."produits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lignes_bordereau" ADD CONSTRAINT "lignes_bordereau_ligne_commande_id_lignes_commande_id_fk" FOREIGN KEY ("ligne_commande_id") REFERENCES "public"."lignes_commande"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bordereaux_entreprise_idx" ON "bordereaux" USING btree ("entreprise_id");--> statement-breakpoint
CREATE INDEX "bordereaux_collecteur_idx" ON "bordereaux" USING btree ("collecteur_id");--> statement-breakpoint
CREATE INDEX "journal_audit_created_idx" ON "journal_audit" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "journal_audit_action_idx" ON "journal_audit" USING btree ("action");--> statement-breakpoint
CREATE INDEX "lignes_bordereau_bordereau_idx" ON "lignes_bordereau" USING btree ("bordereau_id");--> statement-breakpoint
CREATE INDEX "lignes_bordereau_produit_idx" ON "lignes_bordereau" USING btree ("produit_id");