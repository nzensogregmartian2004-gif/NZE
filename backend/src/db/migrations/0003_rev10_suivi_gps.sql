CREATE TABLE "reglages" (
	"cle" text PRIMARY KEY NOT NULL,
	"valeur" text NOT NULL,
	"acteur_id" uuid,
	"mis_a_jour_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "livraisons" DROP CONSTRAINT "livraisons_statut_chk";--> statement-breakpoint
ALTER TABLE "livraisons" ADD COLUMN "livreur_latitude" double precision;--> statement-breakpoint
ALTER TABLE "livraisons" ADD COLUMN "livreur_longitude" double precision;--> statement-breakpoint
ALTER TABLE "livraisons" ADD COLUMN "livreur_position_le" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "livraisons" ADD COLUMN "arrive_le" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reglages" ADD CONSTRAINT "reglages_acteur_id_users_id_fk" FOREIGN KEY ("acteur_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "livraisons" ADD CONSTRAINT "livraisons_statut_chk" CHECK ("livraisons"."statut" in ('ASSIGNEE','EN_ROUTE','ARRIVE','LIVREE','PARTIELLE','ECHEC'));