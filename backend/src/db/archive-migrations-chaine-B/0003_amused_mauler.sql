CREATE TYPE "public"."service_validation_status" AS ENUM('en_attente', 'valide', 'refuse', 'suspendu');--> statement-breakpoint
CREATE TYPE "public"."post_moderation_status" AS ENUM('en_attente', 'publie', 'refuse');--> statement-breakpoint
CREATE TYPE "public"."job_confirmation_status" AS ENUM('en_attente', 'confirmee', 'refusee');--> statement-breakpoint
CREATE TYPE "public"."review_target_type" AS ENUM('magasin', 'produit', 'prestataire', 'livreur', 'chauffeur', 'vehicule');--> statement-breakpoint
CREATE TABLE "service_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_activity_id" uuid NOT NULL,
	"metier" varchar(100) NOT NULL,
	"zone_intervention" varchar(255),
	"tarif_indicatif" varchar(100),
	"description" text,
	"disponible" boolean DEFAULT true NOT NULL,
	"statut_validation" "service_validation_status" DEFAULT 'en_attente' NOT NULL,
	"note_moyenne" numeric(3, 2),
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"maj_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_profiles_user_activity_id_unique" UNIQUE("user_activity_id")
);
--> statement-breakpoint
CREATE TABLE "service_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_profile_id" uuid NOT NULL,
	"competence" varchar(100) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_post_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"contenu" text NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_post_likes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_post_likes_post_id_user_id_unique" UNIQUE("post_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "service_post_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"url" varchar(500) NOT NULL,
	"ordre" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_profile_id" uuid NOT NULL,
	"titre" varchar(150) NOT NULL,
	"description" text,
	"categorie_id" uuid,
	"localisation_latitude" double precision,
	"localisation_longitude" double precision,
	"statut_moderation" "post_moderation_status" DEFAULT 'en_attente' NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verified_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_profile_id" uuid NOT NULL,
	"client_activity_id" uuid NOT NULL,
	"description" text NOT NULL,
	"date_prestation" date NOT NULL,
	"statut_confirmation" "job_confirmation_status" DEFAULT 'en_attente' NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auteur_id" uuid NOT NULL,
	"cible_type" "review_target_type" NOT NULL,
	"cible_id" uuid NOT NULL,
	"note" integer NOT NULL,
	"commentaire" text,
	"verifie" boolean DEFAULT false NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "service_profiles" ADD CONSTRAINT "service_profiles_user_activity_id_user_activities_id_fk" FOREIGN KEY ("user_activity_id") REFERENCES "public"."user_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_skills" ADD CONSTRAINT "service_skills_service_profile_id_service_profiles_id_fk" FOREIGN KEY ("service_profile_id") REFERENCES "public"."service_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_post_comments" ADD CONSTRAINT "service_post_comments_post_id_service_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."service_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_post_comments" ADD CONSTRAINT "service_post_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_post_likes" ADD CONSTRAINT "service_post_likes_post_id_service_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."service_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_post_likes" ADD CONSTRAINT "service_post_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_post_photos" ADD CONSTRAINT "service_post_photos_post_id_service_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."service_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_posts" ADD CONSTRAINT "service_posts_service_profile_id_service_profiles_id_fk" FOREIGN KEY ("service_profile_id") REFERENCES "public"."service_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_posts" ADD CONSTRAINT "service_posts_categorie_id_categories_id_fk" FOREIGN KEY ("categorie_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verified_jobs" ADD CONSTRAINT "verified_jobs_service_profile_id_service_profiles_id_fk" FOREIGN KEY ("service_profile_id") REFERENCES "public"."service_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verified_jobs" ADD CONSTRAINT "verified_jobs_client_activity_id_user_activities_id_fk" FOREIGN KEY ("client_activity_id") REFERENCES "public"."user_activities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_auteur_id_users_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;