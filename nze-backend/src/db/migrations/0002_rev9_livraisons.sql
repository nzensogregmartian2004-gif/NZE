CREATE TABLE "lignes_livraison" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"livraison_id" uuid NOT NULL,
	"ligne_commande_id" uuid NOT NULL,
	"produit_id" uuid NOT NULL,
	"nom_article" text NOT NULL,
	"quantite_demandee" integer NOT NULL,
	"quantite_livree" integer DEFAULT 0 NOT NULL,
	"statut_ligne" text DEFAULT 'EN_ATTENTE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lignes_livraison_demandee_chk" CHECK ("lignes_livraison"."quantite_demandee" > 0),
	CONSTRAINT "lignes_livraison_livree_chk" CHECK ("lignes_livraison"."quantite_livree" >= 0 and "lignes_livraison"."quantite_livree" <= "lignes_livraison"."quantite_demandee"),
	CONSTRAINT "lignes_livraison_statut_chk" CHECK ("lignes_livraison"."statut_ligne" in ('EN_ATTENTE','LIVREE','PARTIELLE','NON_LIVREE'))
);
--> statement-breakpoint
CREATE TABLE "livraisons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"numero" integer GENERATED ALWAYS AS IDENTITY (sequence name "livraisons_numero_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"commande_id" uuid NOT NULL,
	"livreur_id" uuid NOT NULL,
	"assignee_par" uuid NOT NULL,
	"motif" text NOT NULL,
	"statut" text NOT NULL,
	"code_livraison" text,
	"tentatives_code" integer DEFAULT 0 NOT NULL,
	"signature_papier_recue" boolean DEFAULT false NOT NULL,
	"motif_echec" text,
	"commentaire" text,
	"latitude" double precision,
	"longitude" double precision,
	"demarree_le" timestamp with time zone,
	"cloturee_le" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "livraisons_motif_chk" CHECK ("livraisons"."motif" in ('LIVRAISON_COMMANDE','NOUVELLE_TENTATIVE','SECONDE_LIVRAISON')),
	CONSTRAINT "livraisons_statut_chk" CHECK ("livraisons"."statut" in ('ASSIGNEE','EN_ROUTE','LIVREE','PARTIELLE','ECHEC')),
	CONSTRAINT "livraisons_motif_echec_chk" CHECK ("livraisons"."motif_echec" is null or "livraisons"."motif_echec" in ('CLIENT_ABSENT','REFUS_CLIENT','ADRESSE_INTROUVABLE','AUTRE')),
	CONSTRAINT "livraisons_tentatives_chk" CHECK ("livraisons"."tentatives_code" >= 0)
);
--> statement-breakpoint
ALTER TABLE "lignes_livraison" ADD CONSTRAINT "lignes_livraison_livraison_id_livraisons_id_fk" FOREIGN KEY ("livraison_id") REFERENCES "public"."livraisons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lignes_livraison" ADD CONSTRAINT "lignes_livraison_ligne_commande_id_lignes_commande_id_fk" FOREIGN KEY ("ligne_commande_id") REFERENCES "public"."lignes_commande"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lignes_livraison" ADD CONSTRAINT "lignes_livraison_produit_id_produits_id_fk" FOREIGN KEY ("produit_id") REFERENCES "public"."produits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "livraisons" ADD CONSTRAINT "livraisons_commande_id_commandes_id_fk" FOREIGN KEY ("commande_id") REFERENCES "public"."commandes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "livraisons" ADD CONSTRAINT "livraisons_livreur_id_users_id_fk" FOREIGN KEY ("livreur_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "livraisons" ADD CONSTRAINT "livraisons_assignee_par_users_id_fk" FOREIGN KEY ("assignee_par") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lignes_livraison_livraison_idx" ON "lignes_livraison" USING btree ("livraison_id");--> statement-breakpoint
CREATE INDEX "lignes_livraison_ligne_commande_idx" ON "lignes_livraison" USING btree ("ligne_commande_id");--> statement-breakpoint
CREATE INDEX "livraisons_commande_idx" ON "livraisons" USING btree ("commande_id");--> statement-breakpoint
CREATE INDEX "livraisons_livreur_idx" ON "livraisons" USING btree ("livreur_id");