CREATE TABLE "tentatives_connexion" (
	"telephone" text PRIMARY KEY NOT NULL,
	"echecs" integer DEFAULT 0 NOT NULL,
	"verrouille_jusqua" timestamp with time zone,
	"mis_a_jour_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "commandes" ADD COLUMN "fournisseur_distance" text;--> statement-breakpoint
ALTER TABLE "commandes" ADD COLUMN "distance_calculee_le" timestamp with time zone;