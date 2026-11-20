CREATE TABLE "adresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"libelle" text NOT NULL,
	"quartier" text NOT NULL,
	"repere" text,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"photo_cle" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listes_envies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"produit_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "adresses" ADD CONSTRAINT "adresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listes_envies" ADD CONSTRAINT "listes_envies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listes_envies" ADD CONSTRAINT "listes_envies_produit_id_produits_id_fk" FOREIGN KEY ("produit_id") REFERENCES "public"."produits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "adresses_user_idx" ON "adresses" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "listes_envies_user_produit_idx" ON "listes_envies" USING btree ("user_id","produit_id");