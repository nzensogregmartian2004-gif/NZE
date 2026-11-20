DROP TABLE "drivers" CASCADE;--> statement-breakpoint
DROP TABLE "rides" CASCADE;--> statement-breakpoint
-- Purge explicite des données taxi/moto (hors périmètre du cahier des charges v1.0)
DELETE FROM "reviews" WHERE "cible_type" = 'chauffeur';--> statement-breakpoint
DELETE FROM "user_activities" WHERE "type" = 'chauffeur';--> statement-breakpoint
ALTER TABLE "user_activities" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."activity_type";--> statement-breakpoint
CREATE TYPE "public"."activity_type" AS ENUM('client', 'commercant', 'prestataire', 'livreur', 'proprietaire_vehicule');--> statement-breakpoint
ALTER TABLE "user_activities" ALTER COLUMN "type" SET DATA TYPE "public"."activity_type" USING "type"::"public"."activity_type";--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "cible_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."review_target_type";--> statement-breakpoint
CREATE TYPE "public"."review_target_type" AS ENUM('magasin', 'produit', 'prestataire', 'livreur', 'vehicule');--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "cible_type" SET DATA TYPE "public"."review_target_type" USING "cible_type"::"public"."review_target_type";--> statement-breakpoint
DROP TYPE "public"."driver_service_type";--> statement-breakpoint
DROP TYPE "public"."driver_validation_status";--> statement-breakpoint
DROP TYPE "public"."ride_status";