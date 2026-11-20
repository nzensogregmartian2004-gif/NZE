CREATE TABLE "reclamations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"numero" integer GENERATED ALWAYS AS IDENTITY (sequence name "reclamations_numero_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"client_id" uuid NOT NULL,
	"commande_id" uuid NOT NULL,
	"ligne_commande_id" uuid NOT NULL,
	"produit_id" uuid NOT NULL,
	"nom_article" text NOT NULL,
	"motif" text NOT NULL,
	"description" text NOT NULL,
	"statut" text DEFAULT 'OUVERTE' NOT NULL,
	"echeance_decision_le" timestamp with time zone NOT NULL,
	"solution" text,
	"motif_decision" text,
	"decide_par" uuid,
	"decide_le" timestamp with time zone,
	"cloture_le" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reclamations_motif_chk" CHECK ("reclamations"."motif" in ('ARTICLE_DEFECTUEUX','NON_CONFORME','DOMMAGE_LIVRAISON','ARTICLE_MANQUANT','AUTRE')),
	CONSTRAINT "reclamations_statut_chk" CHECK ("reclamations"."statut" in ('OUVERTE','ACCEPTEE','REFUSEE','CLOTUREE')),
	CONSTRAINT "reclamations_solution_chk" CHECK ("reclamations"."solution" is null or "reclamations"."solution" in ('REPARATION','REMPLACEMENT','RETOUR','REMBOURSEMENT','AUTRE'))
);
--> statement-breakpoint
ALTER TABLE "reclamations" ADD CONSTRAINT "reclamations_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reclamations" ADD CONSTRAINT "reclamations_commande_id_commandes_id_fk" FOREIGN KEY ("commande_id") REFERENCES "public"."commandes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reclamations" ADD CONSTRAINT "reclamations_ligne_commande_id_lignes_commande_id_fk" FOREIGN KEY ("ligne_commande_id") REFERENCES "public"."lignes_commande"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reclamations" ADD CONSTRAINT "reclamations_produit_id_produits_id_fk" FOREIGN KEY ("produit_id") REFERENCES "public"."produits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reclamations" ADD CONSTRAINT "reclamations_decide_par_users_id_fk" FOREIGN KEY ("decide_par") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reclamations_ligne_idx" ON "reclamations" USING btree ("ligne_commande_id");--> statement-breakpoint
CREATE INDEX "reclamations_client_idx" ON "reclamations" USING btree ("client_id");