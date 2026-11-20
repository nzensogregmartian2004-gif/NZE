-- Révision 19 : responsable, priorité et notes internes des réclamations (cahier §17.2),
-- litige partenaire séparé (cahier §16.2). Les colonnes de la révision 11 (bordereaux) sont déjà en place : non répétées ici.
CREATE TABLE "litiges_partenaire" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"numero" integer GENERATED ALWAYS AS IDENTITY (sequence name "litiges_partenaire_numero_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"entreprise_id" uuid NOT NULL,
	"reclamation_id" uuid,
	"motif" text NOT NULL,
	"description" text NOT NULL,
	"statut" text DEFAULT 'OUVERT' NOT NULL,
	"priorite" text DEFAULT 'NORMALE' NOT NULL,
	"responsable_id" uuid,
	"ouvert_par" uuid NOT NULL,
	"issue" text,
	"cloture_le" timestamp with time zone,
	"cloture_par" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "litiges_partenaire_statut_chk" CHECK ("litiges_partenaire"."statut" in ('OUVERT','CLOS')),
	CONSTRAINT "litiges_partenaire_priorite_chk" CHECK ("litiges_partenaire"."priorite" in ('BASSE','NORMALE','HAUTE','URGENTE'))
);
--> statement-breakpoint
CREATE TABLE "reclamations_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reclamation_id" uuid NOT NULL,
	"auteur_id" uuid NOT NULL,
	"texte" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reclamations" ADD COLUMN "responsable_id" uuid;
--> statement-breakpoint
ALTER TABLE "reclamations" ADD COLUMN "priorite" text DEFAULT 'NORMALE' NOT NULL;
--> statement-breakpoint
ALTER TABLE "reclamations" ADD COLUMN "alerte_retard_le" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "litiges_partenaire" ADD CONSTRAINT "litiges_partenaire_entreprise_id_entreprises_id_fk" FOREIGN KEY ("entreprise_id") REFERENCES "public"."entreprises"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "litiges_partenaire" ADD CONSTRAINT "litiges_partenaire_reclamation_id_reclamations_id_fk" FOREIGN KEY ("reclamation_id") REFERENCES "public"."reclamations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "litiges_partenaire" ADD CONSTRAINT "litiges_partenaire_responsable_id_users_id_fk" FOREIGN KEY ("responsable_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "litiges_partenaire" ADD CONSTRAINT "litiges_partenaire_ouvert_par_users_id_fk" FOREIGN KEY ("ouvert_par") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "litiges_partenaire" ADD CONSTRAINT "litiges_partenaire_cloture_par_users_id_fk" FOREIGN KEY ("cloture_par") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "reclamations_notes" ADD CONSTRAINT "reclamations_notes_reclamation_id_reclamations_id_fk" FOREIGN KEY ("reclamation_id") REFERENCES "public"."reclamations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "reclamations_notes" ADD CONSTRAINT "reclamations_notes_auteur_id_users_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "litiges_partenaire_entreprise_idx" ON "litiges_partenaire" USING btree ("entreprise_id");
--> statement-breakpoint
CREATE INDEX "litiges_partenaire_reclamation_idx" ON "litiges_partenaire" USING btree ("reclamation_id");
--> statement-breakpoint
CREATE INDEX "reclamations_notes_reclamation_idx" ON "reclamations_notes" USING btree ("reclamation_id","created_at");
--> statement-breakpoint
ALTER TABLE "reclamations" ADD CONSTRAINT "reclamations_responsable_id_users_id_fk" FOREIGN KEY ("responsable_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "reclamations" ADD CONSTRAINT "reclamations_priorite_chk" CHECK ("reclamations"."priorite" in ('BASSE','NORMALE','HAUTE','URGENTE'));
