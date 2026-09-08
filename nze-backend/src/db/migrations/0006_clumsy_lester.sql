CREATE TYPE "public"."subscription_status" AS ENUM('active', 'expiree', 'annulee');--> statement-breakpoint
CREATE TYPE "public"."ad_status" AS ENUM('en_attente', 'active', 'expiree', 'refusee');--> statement-breakpoint
CREATE TYPE "public"."ad_target_type" AS ENUM('produit', 'magasin', 'prestataire', 'vehicule');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('en_attente', 'reussi', 'echoue');--> statement-breakpoint
CREATE TYPE "public"."payment_type" AS ENUM('abonnement', 'publicite', 'autre');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('en_attente', 'traite', 'rejete');--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nom" varchar(100) NOT NULL,
	"prix" numeric(12, 2) NOT NULL,
	"duree_jours" integer NOT NULL,
	"fonctionnalites" jsonb,
	"actif" boolean DEFAULT true NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_activity_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"statut" "subscription_status" DEFAULT 'active' NOT NULL,
	"expire_le" timestamp with time zone NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "advertisements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cible_type" "ad_target_type" NOT NULL,
	"cible_id" uuid NOT NULL,
	"prix" numeric(12, 2) NOT NULL,
	"emplacement" varchar(100),
	"date_debut" date NOT NULL,
	"date_fin" date NOT NULL,
	"statut" "ad_status" DEFAULT 'en_attente' NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"montant" numeric(12, 2) NOT NULL,
	"type" "payment_type" NOT NULL,
	"statut" "payment_status" DEFAULT 'en_attente' NOT NULL,
	"reference" varchar(100),
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"cible_type" varchar(50),
	"cible_id" uuid,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auteur_id" uuid NOT NULL,
	"cible_type" varchar(50) NOT NULL,
	"cible_id" uuid NOT NULL,
	"motif" text NOT NULL,
	"statut" "report_status" DEFAULT 'en_attente' NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_activity_id_user_activities_id_fk" FOREIGN KEY ("user_activity_id") REFERENCES "public"."user_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_auteur_id_users_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;