-- Alignement du schéma TypeScript et des migrations (audit de reconstitution).
-- Ces contraintes, index et défauts existent déjà dans la base après les migrations 0000-0020,
-- mais le snapshot ne les décrivait pas à l'identique au schéma TypeScript. Sans cette migration,
-- drizzle-kit générerait des DROP sur ces objets à la prochaine génération.
-- Idempotente : IF EXISTS / IF NOT EXISTS. Aucune donnée n'est modifiée.
ALTER TABLE "service_profiles" DROP CONSTRAINT IF EXISTS "service_profiles_nombre_vues_nonnegative_chk";
--> statement-breakpoint
ALTER TABLE "vehicle_bookings" DROP CONSTRAINT IF EXISTS "vehicle_bookings_dates_chk";
--> statement-breakpoint
ALTER TABLE "vehicle_bookings" DROP CONSTRAINT IF EXISTS "vehicle_bookings_amount_positive_chk";
--> statement-breakpoint
ALTER TABLE "advertisements" DROP CONSTRAINT IF EXISTS "advertisements_payment_status_chk";
--> statement-breakpoint
ALTER TABLE "advertisements" DROP CONSTRAINT IF EXISTS "advertisements_stats_nonnegative_chk";
--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_transaction_type_check";
--> statement-breakpoint
ALTER TABLE "service_requests" DROP CONSTRAINT IF EXISTS "service_requests_budget_nonnegative_chk";
--> statement-breakpoint
ALTER TABLE "service_requests" DROP CONSTRAINT IF EXISTS "service_requests_price_nonnegative_chk";
--> statement-breakpoint
ALTER TABLE "lodgings" DROP CONSTRAINT IF EXISTS "lodgings_prix_positive_chk";
--> statement-breakpoint
ALTER TABLE "lodgings" DROP CONSTRAINT IF EXISTS "lodgings_capacite_positive_chk";
--> statement-breakpoint
ALTER TABLE "lodgings" DROP CONSTRAINT IF EXISTS "lodgings_nombre_vues_nonnegative_chk";
--> statement-breakpoint
ALTER TABLE "lodgings" DROP CONSTRAINT IF EXISTS "lodgings_nombre_avis_nonnegative_chk";
--> statement-breakpoint
ALTER TABLE "lodging_bookings" DROP CONSTRAINT IF EXISTS "lodging_bookings_dates_chk";
--> statement-breakpoint
ALTER TABLE "lodging_bookings" DROP CONSTRAINT IF EXISTS "lodging_bookings_guests_chk";
--> statement-breakpoint
ALTER TABLE "lodging_bookings" DROP CONSTRAINT IF EXISTS "lodging_bookings_price_chk";
--> statement-breakpoint
ALTER TABLE "advertisement_pricing" DROP CONSTRAINT IF EXISTS "advertisement_pricing_prix_par_jour_chk";
--> statement-breakpoint
ALTER TABLE "advertisement_pricing" DROP CONSTRAINT IF EXISTS "advertisement_pricing_devise_chk";
--> statement-breakpoint
ALTER TABLE "editorial_features" DROP CONSTRAINT IF EXISTS "editorial_features_date_chk";
--> statement-breakpoint
ALTER TABLE "editorial_features" DROP CONSTRAINT IF EXISTS "editorial_features_order_nonnegative_chk";
--> statement-breakpoint
ALTER TABLE "user_tutorial_progress" DROP CONSTRAINT IF EXISTS "user_tutorial_progress_status_chk";
--> statement-breakpoint
ALTER TABLE "user_tutorial_progress" DROP CONSTRAINT IF EXISTS "user_tutorial_progress_step_chk";
--> statement-breakpoint
ALTER TABLE "support_requests" DROP CONSTRAINT IF EXISTS "support_requests_category_chk";
--> statement-breakpoint
ALTER TABLE "support_requests" DROP CONSTRAINT IF EXISTS "support_requests_status_chk";
--> statement-breakpoint
DROP INDEX IF EXISTS "orders_client_activity_id_idempotency_key_uq";
--> statement-breakpoint
DROP INDEX IF EXISTS "subscriptions_pending_activity_uq";
--> statement-breakpoint
DROP INDEX IF EXISTS "payments_merchant_reference_uq";
--> statement-breakpoint
DROP INDEX IF EXISTS "payments_provider_reference_uq";
--> statement-breakpoint
DROP INDEX IF EXISTS "admin_actions_created_idx";
--> statement-breakpoint
ALTER TABLE "vehicles" ALTER COLUMN "nombre_avis" SET DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "rappel_7j_envoye" SET DEFAULT false;
--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "rappel_1j_envoye" SET DEFAULT false;
--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "expiration_notifiee" SET DEFAULT false;
--> statement-breakpoint
ALTER TABLE "advertisements" ALTER COLUMN "impressions" SET DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "advertisements" ALTER COLUMN "clics" SET DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "advertisements" ALTER COLUMN "commandes_attribuees" SET DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "lodgings" ALTER COLUMN "capacite" SET DEFAULT 1;
--> statement-breakpoint
ALTER TABLE "lodgings" ALTER COLUMN "disponible" SET DEFAULT true;
--> statement-breakpoint
ALTER TABLE "lodgings" ALTER COLUMN "nombre_vues" SET DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "lodgings" ALTER COLUMN "nombre_avis" SET DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "lodging_photos" ALTER COLUMN "ordre" SET DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "lodging_bookings" ALTER COLUMN "nombre_voyageurs" SET DEFAULT 1;
--> statement-breakpoint
ALTER TABLE "advertisement_pricing" ALTER COLUMN "actif" SET DEFAULT true;
--> statement-breakpoint
ALTER TABLE "editorial_features" ALTER COLUMN "ordre" SET DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "editorial_features" ALTER COLUMN "actif" SET DEFAULT true;
--> statement-breakpoint
ALTER TABLE "user_tutorial_progress" ALTER COLUMN "current_step" SET DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "in_app_enabled" SET DEFAULT true;
--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "order_updates" SET DEFAULT true;
--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "delivery_updates" SET DEFAULT true;
--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "payment_updates" SET DEFAULT true;
--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "booking_updates" SET DEFAULT true;
--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "service_updates" SET DEFAULT true;
--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "reviews_reports_updates" SET DEFAULT true;
--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "marketing_updates" SET DEFAULT false;
--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "system_updates" SET DEFAULT true;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_store_created_idx" ON "orders" USING btree ("store_id","cree_le");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "orders_client_activity_id_idempotency_key_uq" ON "orders" USING btree ("client_activity_id","idempotency_key") WHERE "orders"."idempotency_key" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_pending_activity_uq" ON "subscriptions" USING btree ("pending_activity_id") WHERE "subscriptions"."pending_activity_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payments_merchant_reference_uq" ON "payments" USING btree ("merchant_reference") WHERE "payments"."merchant_reference" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payments_provider_reference_uq" ON "payments" USING btree ("provider_reference") WHERE "payments"."provider_reference" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_actions_created_idx" ON "admin_actions" USING btree ("cree_le");
--> statement-breakpoint
ALTER TABLE "service_profiles" ADD CONSTRAINT "service_profiles_nombre_vues_nonnegative_chk" CHECK ("service_profiles"."nombre_vues" >= 0);
--> statement-breakpoint
ALTER TABLE "vehicle_bookings" ADD CONSTRAINT "vehicle_bookings_dates_chk" CHECK ("vehicle_bookings"."date_fin" > "vehicle_bookings"."date_debut");
--> statement-breakpoint
ALTER TABLE "vehicle_bookings" ADD CONSTRAINT "vehicle_bookings_amount_positive_chk" CHECK ("vehicle_bookings"."montant_total" IS NULL OR "vehicle_bookings"."montant_total" >= 0);
--> statement-breakpoint
ALTER TABLE "advertisements" ADD CONSTRAINT "advertisements_payment_status_chk" CHECK ("advertisements"."paiement_statut" IN ('en_attente', 'confirme', 'echoue', 'incertain'));
--> statement-breakpoint
ALTER TABLE "advertisements" ADD CONSTRAINT "advertisements_stats_nonnegative_chk" CHECK ("advertisements"."impressions" >= 0 AND "advertisements"."clics" >= 0 AND "advertisements"."commandes_attribuees" >= 0);
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_transaction_type_check" CHECK ("payments"."transaction_type" IN ('PAYMENT', 'GIVE_CHANGE'));
--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_budget_nonnegative_chk" CHECK ("service_requests"."budget_indicatif" IS NULL OR "service_requests"."budget_indicatif" >= 0);
--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_price_nonnegative_chk" CHECK ("service_requests"."prix_accepte" IS NULL OR "service_requests"."prix_accepte" >= 0);
--> statement-breakpoint
ALTER TABLE "lodgings" ADD CONSTRAINT "lodgings_prix_positive_chk" CHECK ("lodgings"."prix_par_nuit" > 0);
--> statement-breakpoint
ALTER TABLE "lodgings" ADD CONSTRAINT "lodgings_capacite_positive_chk" CHECK ("lodgings"."capacite" > 0);
--> statement-breakpoint
ALTER TABLE "lodgings" ADD CONSTRAINT "lodgings_nombre_vues_nonnegative_chk" CHECK ("lodgings"."nombre_vues" >= 0);
--> statement-breakpoint
ALTER TABLE "lodgings" ADD CONSTRAINT "lodgings_nombre_avis_nonnegative_chk" CHECK ("lodgings"."nombre_avis" >= 0);
--> statement-breakpoint
ALTER TABLE "lodging_bookings" ADD CONSTRAINT "lodging_bookings_dates_chk" CHECK ("lodging_bookings"."date_fin" > "lodging_bookings"."date_debut");
--> statement-breakpoint
ALTER TABLE "lodging_bookings" ADD CONSTRAINT "lodging_bookings_guests_chk" CHECK ("lodging_bookings"."nombre_voyageurs" > 0);
--> statement-breakpoint
ALTER TABLE "lodging_bookings" ADD CONSTRAINT "lodging_bookings_price_chk" CHECK ("lodging_bookings"."prix_nuit_snapshot" > 0 AND "lodging_bookings"."montant_total" > 0);
--> statement-breakpoint
ALTER TABLE "advertisement_pricing" ADD CONSTRAINT "advertisement_pricing_prix_par_jour_chk" CHECK ("advertisement_pricing"."prix_par_jour" > 0);
--> statement-breakpoint
ALTER TABLE "advertisement_pricing" ADD CONSTRAINT "advertisement_pricing_devise_chk" CHECK ("advertisement_pricing"."devise" = 'XAF');
--> statement-breakpoint
ALTER TABLE "editorial_features" ADD CONSTRAINT "editorial_features_date_chk" CHECK ("editorial_features"."date_fin" >= "editorial_features"."date_debut");
--> statement-breakpoint
ALTER TABLE "editorial_features" ADD CONSTRAINT "editorial_features_order_nonnegative_chk" CHECK ("editorial_features"."ordre" >= 0);
--> statement-breakpoint
ALTER TABLE "user_tutorial_progress" ADD CONSTRAINT "user_tutorial_progress_status_chk" CHECK ("user_tutorial_progress"."status" IN ('started', 'skipped', 'completed'));
--> statement-breakpoint
ALTER TABLE "user_tutorial_progress" ADD CONSTRAINT "user_tutorial_progress_step_chk" CHECK ("user_tutorial_progress"."current_step" >= 0);
--> statement-breakpoint
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_category_chk" CHECK ("support_requests"."category" IN ('compte', 'commande', 'paiement', 'livraison', 'reservation', 'prestation', 'signalement', 'autre'));
--> statement-breakpoint
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_status_chk" CHECK ("support_requests"."status" IN ('ouvert', 'en_cours', 'resolu', 'ferme'));
