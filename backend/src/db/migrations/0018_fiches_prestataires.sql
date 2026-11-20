CREATE TABLE IF NOT EXISTS "fiches_prestataires" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nom_public" text NOT NULL,
	"activite" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"zone" text,
	"statut" text DEFAULT 'BROUILLON' NOT NULL,
	"ordre" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fiches_prestataires_statut_chk" CHECK ("fiches_prestataires"."statut" in ('BROUILLON','PUBLIEE','SUSPENDUE'))
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "demandes_prestataire" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fiche_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"motif" text NOT NULL,
	"message" text NOT NULL,
	"statut" text DEFAULT 'NOUVELLE' NOT NULL,
	"note_nze" text,
	"traitee_le" timestamp with time zone,
	"traitee_par" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "demandes_prestataire_statut_chk" CHECK ("demandes_prestataire"."statut" in ('NOUVELLE','TRAITEE','CLOTUREE')),
	CONSTRAINT "demandes_prestataire_motif_chk" CHECK ("demandes_prestataire"."motif" in ('INFORMATION','DEVIS','AUTRE'))
);--> statement-breakpoint
ALTER TABLE "demandes_prestataire" ADD CONSTRAINT "demandes_prestataire_fiche_id_fiches_prestataires_id_fk" FOREIGN KEY ("fiche_id") REFERENCES "public"."fiches_prestataires"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demandes_prestataire" ADD CONSTRAINT "demandes_prestataire_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demandes_prestataire" ADD CONSTRAINT "demandes_prestataire_traitee_par_users_id_fk" FOREIGN KEY ("traitee_par") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
