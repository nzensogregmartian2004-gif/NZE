CREATE TYPE "public"."vehicle_type" AS ENUM('voiture', 'moto', 'camionnette', 'pick_up', 'camion', 'autre');--> statement-breakpoint
CREATE TYPE "public"."vehicle_validation_status" AS ENUM('en_attente', 'valide', 'refuse', 'suspendu');--> statement-breakpoint
CREATE TYPE "public"."driver_service_type" AS ENUM('taxi', 'moto');--> statement-breakpoint
CREATE TYPE "public"."driver_validation_status" AS ENUM('en_attente', 'valide', 'refuse', 'suspendu');--> statement-breakpoint
CREATE TYPE "public"."ride_status" AS ENUM('demandee', 'chauffeur_recherche', 'acceptee', 'en_cours', 'terminee', 'annulee');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('demandee', 'acceptee', 'refusee', 'terminee', 'annulee');--> statement-breakpoint
CREATE TABLE "vehicle_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"url" varchar(500) NOT NULL,
	"ordre" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_activity_id" uuid NOT NULL,
	"type" "vehicle_type" NOT NULL,
	"marque" varchar(100),
	"modele" varchar(100),
	"annee" integer,
	"capacite" varchar(100),
	"description" text,
	"prix" numeric(12, 2),
	"conditions_location" text,
	"latitude" double precision,
	"longitude" double precision,
	"disponibilite" jsonb,
	"disponible" boolean DEFAULT true NOT NULL,
	"statut_validation" "vehicle_validation_status" DEFAULT 'en_attente' NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"maj_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drivers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_activity_id" uuid NOT NULL,
	"vehicle_id" uuid,
	"type_service" "driver_service_type" NOT NULL,
	"disponible" boolean DEFAULT false NOT NULL,
	"statut_validation" "driver_validation_status" DEFAULT 'en_attente' NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"maj_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drivers_user_activity_id_unique" UNIQUE("user_activity_id")
);
--> statement-breakpoint
CREATE TABLE "rides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_activity_id" uuid NOT NULL,
	"driver_id" uuid,
	"type_service" "driver_service_type" NOT NULL,
	"statut" "ride_status" DEFAULT 'demandee' NOT NULL,
	"position_depart_latitude" double precision NOT NULL,
	"position_depart_longitude" double precision NOT NULL,
	"position_arrivee_latitude" double precision,
	"position_arrivee_longitude" double precision,
	"prix_estime" numeric(12, 2),
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"maj_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"client_activity_id" uuid NOT NULL,
	"date_debut" date NOT NULL,
	"date_fin" date NOT NULL,
	"statut" "booking_status" DEFAULT 'demandee' NOT NULL,
	"message" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vehicle_photos" ADD CONSTRAINT "vehicle_photos_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_user_activity_id_user_activities_id_fk" FOREIGN KEY ("user_activity_id") REFERENCES "public"."user_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_user_activity_id_user_activities_id_fk" FOREIGN KEY ("user_activity_id") REFERENCES "public"."user_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rides" ADD CONSTRAINT "rides_client_activity_id_user_activities_id_fk" FOREIGN KEY ("client_activity_id") REFERENCES "public"."user_activities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rides" ADD CONSTRAINT "rides_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_bookings" ADD CONSTRAINT "vehicle_bookings_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_bookings" ADD CONSTRAINT "vehicle_bookings_client_activity_id_user_activities_id_fk" FOREIGN KEY ("client_activity_id") REFERENCES "public"."user_activities"("id") ON DELETE no action ON UPDATE no action;