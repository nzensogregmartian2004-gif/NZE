CREATE TYPE "public"."deliverer_validation_status" AS ENUM('en_attente', 'valide', 'refuse', 'suspendu');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('nouvelle', 'confirmee', 'produit_pret', 'terminee', 'annulee');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('nouvelle', 'en_attente', 'livreur_recherche', 'livreur_attribue', 'acceptee', 'en_route_vers_magasin', 'arrive_au_magasin', 'produit_recupere', 'en_route_vers_client', 'arrive_chez_client', 'livraison_terminee', 'annulee');--> statement-breakpoint
CREATE TABLE "deliverers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_activity_id" uuid NOT NULL,
	"type_vehicule" varchar(50) NOT NULL,
	"vehicule_infos" jsonb,
	"documents" jsonb,
	"disponible" boolean DEFAULT false NOT NULL,
	"statut_validation" "deliverer_validation_status" DEFAULT 'en_attente' NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"maj_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deliverers_user_activity_id_unique" UNIQUE("user_activity_id")
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantite" integer NOT NULL,
	"prix_unitaire" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_activity_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"statut" "order_status" DEFAULT 'nouvelle' NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"livraison_latitude" double precision,
	"livraison_longitude" double precision,
	"livraison_indication" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"maj_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid,
	"deliverer_id" uuid,
	"statut" "delivery_status" DEFAULT 'nouvelle' NOT NULL,
	"position_depart_latitude" double precision,
	"position_depart_longitude" double precision,
	"position_client_latitude" double precision,
	"position_client_longitude" double precision,
	"type_livraison" varchar(100),
	"description" text,
	"remuneration" numeric(12, 2),
	"instructions" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"maj_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entite_type" varchar(30) NOT NULL,
	"entite_id" uuid NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"maj_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deliverers" ADD CONSTRAINT "deliverers_user_activity_id_user_activities_id_fk" FOREIGN KEY ("user_activity_id") REFERENCES "public"."user_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_client_activity_id_user_activities_id_fk" FOREIGN KEY ("client_activity_id") REFERENCES "public"."user_activities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_deliverer_id_deliverers_id_fk" FOREIGN KEY ("deliverer_id") REFERENCES "public"."deliverers"("id") ON DELETE no action ON UPDATE no action;