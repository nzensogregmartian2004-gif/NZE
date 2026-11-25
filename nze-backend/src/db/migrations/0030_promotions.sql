CREATE TABLE "promotions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"produit_id" uuid NOT NULL,
	"titre" text NOT NULL,
	"pourcentage" integer NOT NULL,
	"debut" timestamp with time zone NOT NULL,
	"fin" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promotions_pourcentage_chk" CHECK ("promotions"."pourcentage" between 1 and 90),
	CONSTRAINT "promotions_dates_chk" CHECK ("promotions"."fin" > "promotions"."debut")
);
--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_produit_id_produits_id_fk" FOREIGN KEY ("produit_id") REFERENCES "public"."produits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "promotions_fin_idx" ON "promotions" USING btree ("fin");