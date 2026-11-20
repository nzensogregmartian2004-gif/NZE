CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nom" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "commandes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"user_id" uuid NOT NULL,
	"statut" text DEFAULT 'PANIER' NOT NULL,
	"reception" text NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"point_fixe_id" uuid,
	"tarif_id" uuid,
	"distance_m" integer,
	"frais_livraison_fcfa" integer DEFAULT 0 NOT NULL,
	"sous_total_fcfa" integer NOT NULL,
	"total_fcfa" integer NOT NULL,
	"paye_le" timestamp with time zone,
	"choix_sur_place" boolean DEFAULT false NOT NULL,
	"origine_latitude" double precision,
	"origine_longitude" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commandes_reference_unique" UNIQUE("reference"),
	CONSTRAINT "commande_statut_chk" CHECK ("commandes"."statut" in ('PANIER','EN_ATTENTE_PAIEMENT','PAYEE','ECHEC','ANNULEE')),
	CONSTRAINT "commande_reception_chk" CHECK ("commandes"."reception" in ('LIVRAISON','RETRAIT')),
	CONSTRAINT "commande_total_chk" CHECK ("commandes"."total_fcfa" >= 0)
);
--> statement-breakpoint
CREATE TABLE "commissions_regles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entreprise_id" uuid NOT NULL,
	"taux_bps" integer NOT NULL,
	"effet_debut" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commission_taux_chk" CHECK ("commissions_regles"."taux_bps" >= 0 and "commissions_regles"."taux_bps" <= 10000)
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"produit_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demandes_retrait" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entreprise_id" uuid NOT NULL,
	"demandeur_id" uuid NOT NULL,
	"montant_fcfa" integer NOT NULL,
	"operateur" text NOT NULL,
	"numero" text NOT NULL,
	"nom_beneficiaire" text NOT NULL,
	"statut" text DEFAULT 'EN_ATTENTE' NOT NULL,
	"reference_marchand" text,
	"reference_fournisseur" text,
	"decide_par" uuid,
	"decide_le" timestamp with time zone,
	"dernier_controle" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "demandes_retrait_reference_marchand_unique" UNIQUE("reference_marchand"),
	CONSTRAINT "retrait_montant_chk" CHECK ("demandes_retrait"."montant_fcfa" > 0),
	CONSTRAINT "retrait_operateur_chk" CHECK ("demandes_retrait"."operateur" in ('AIRTEL_MONEY','MOOV_MONEY')),
	CONSTRAINT "retrait_statut_chk" CHECK ("demandes_retrait"."statut" in ('EN_ATTENTE','REJETEE','VERSEMENT_EN_COURS','VERSEE','ECHEC'))
);
--> statement-breakpoint
CREATE TABLE "ecritures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"commande_id" uuid NOT NULL,
	"ligne_id" uuid,
	"entreprise_id" uuid,
	"categorie" text NOT NULL,
	"montant_fcfa" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ecriture_categorie_chk" CHECK ("ecritures"."categorie" in ('VENTE_NET','COMMISSION','FRAIS_LIVRAISON')),
	CONSTRAINT "ecriture_montant_chk" CHECK ("ecritures"."montant_fcfa" >= 0)
);
--> statement-breakpoint
CREATE TABLE "entreprises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nom" text NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "etablissements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entreprise_id" uuid NOT NULL,
	"nom" text NOT NULL,
	"adresse" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lignes_commande" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"commande_id" uuid NOT NULL,
	"produit_id" uuid NOT NULL,
	"entreprise_id" uuid NOT NULL,
	"quantite" integer NOT NULL,
	"prix_unitaire_fcfa" integer NOT NULL,
	"montant_ligne_fcfa" integer NOT NULL,
	"taux_commission_bps" integer NOT NULL,
	"commission_fcfa" integer NOT NULL,
	"garantie_jours" integer,
	CONSTRAINT "ligne_quantite_chk" CHECK ("lignes_commande"."quantite" > 0)
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"expediteur_id" uuid NOT NULL,
	"genre" text NOT NULL,
	"corps" text,
	"fichier_cle" text,
	"duree_sec" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_genre_chk" CHECK ("messages"."genre" in ('TEXTE','PHOTO','VIDEO','VOCAL'))
);
--> statement-breakpoint
CREATE TABLE "mouvements_stock" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"produit_id" uuid NOT NULL,
	"type" text NOT NULL,
	"delta_disponible" integer DEFAULT 0 NOT NULL,
	"delta_reserve" integer DEFAULT 0 NOT NULL,
	"disponible_apres" integer NOT NULL,
	"reserve_apres" integer NOT NULL,
	"commande_id" uuid,
	"acteur_id" uuid,
	"motif" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"telephone" text NOT NULL,
	"code_hash" text NOT NULL,
	"tentatives" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "points_fixes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"libelle" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"effet_debut" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "produits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entreprise_id" uuid NOT NULL,
	"etablissement_id" uuid,
	"categorie_id" uuid,
	"nom" text NOT NULL,
	"description" text,
	"prix_fcfa" integer NOT NULL,
	"statut" text DEFAULT 'PUBLIE' NOT NULL,
	"garantie_jours" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "produits_prix_chk" CHECK ("produits"."prix_fcfa" > 0),
	CONSTRAINT "produits_statut_chk" CHECK ("produits"."statut" in ('BROUILLON','PUBLIE','SUSPENDU'))
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signalements_stock" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"produit_id" uuid NOT NULL,
	"entreprise_id" uuid NOT NULL,
	"acteur_id" uuid NOT NULL,
	"genre" text NOT NULL,
	"quantite" integer DEFAULT 0 NOT NULL,
	"statut" text DEFAULT 'EN_ATTENTE' NOT NULL,
	"decide_par" uuid,
	"decide_le" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signalement_genre_chk" CHECK ("signalements_stock"."genre" in ('VENTE','RUPTURE','RETOUR','VARIATION'))
);
--> statement-breakpoint
CREATE TABLE "stock_niveaux" (
	"produit_id" uuid PRIMARY KEY NOT NULL,
	"disponible" integer DEFAULT 0 NOT NULL,
	"reserve" integer DEFAULT 0 NOT NULL,
	"mis_a_jour" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_disponible_chk" CHECK ("stock_niveaux"."disponible" >= 0),
	CONSTRAINT "stock_reserve_chk" CHECK ("stock_niveaux"."reserve" >= 0)
);
--> statement-breakpoint
CREATE TABLE "tarifs_livraison" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fcfa_par_km" integer NOT NULL,
	"minimum_fcfa" integer DEFAULT 0 NOT NULL,
	"effet_debut" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tarif_km_chk" CHECK ("tarifs_livraison"."fcfa_par_km" >= 0)
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"commande_id" uuid NOT NULL,
	"fournisseur" text DEFAULT 'MYPVIT' NOT NULL,
	"canal" text NOT NULL,
	"operateur" text,
	"reference_marchand" text NOT NULL,
	"reference_fournisseur" text,
	"montant_fcfa" integer NOT NULL,
	"statut" text DEFAULT 'PENDING' NOT NULL,
	"url_paiement" text,
	"dernier_controle" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_reference_marchand_unique" UNIQUE("reference_marchand"),
	CONSTRAINT "transaction_statut_chk" CHECK ("transactions"."statut" in ('PENDING','SUCCESS','FAILED','UNCERTAIN')),
	CONSTRAINT "transaction_canal_chk" CHECK ("transactions"."canal" in ('MOBILE_MONEY','CARTE'))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"telephone" text NOT NULL,
	"role" text DEFAULT 'client' NOT NULL,
	"entreprise_id" uuid,
	"nom_affiche" text,
	"langue" text DEFAULT 'fr' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_telephone_unique" UNIQUE("telephone"),
	CONSTRAINT "users_role_chk" CHECK ("users"."role" in ('client','admin_principal','admin_secondaire','partenaire','livreur'))
);
--> statement-breakpoint
ALTER TABLE "commandes" ADD CONSTRAINT "commandes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commandes" ADD CONSTRAINT "commandes_point_fixe_id_points_fixes_id_fk" FOREIGN KEY ("point_fixe_id") REFERENCES "public"."points_fixes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commandes" ADD CONSTRAINT "commandes_tarif_id_tarifs_livraison_id_fk" FOREIGN KEY ("tarif_id") REFERENCES "public"."tarifs_livraison"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions_regles" ADD CONSTRAINT "commissions_regles_entreprise_id_entreprises_id_fk" FOREIGN KEY ("entreprise_id") REFERENCES "public"."entreprises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_produit_id_produits_id_fk" FOREIGN KEY ("produit_id") REFERENCES "public"."produits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demandes_retrait" ADD CONSTRAINT "demandes_retrait_entreprise_id_entreprises_id_fk" FOREIGN KEY ("entreprise_id") REFERENCES "public"."entreprises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demandes_retrait" ADD CONSTRAINT "demandes_retrait_demandeur_id_users_id_fk" FOREIGN KEY ("demandeur_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demandes_retrait" ADD CONSTRAINT "demandes_retrait_decide_par_users_id_fk" FOREIGN KEY ("decide_par") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ecritures" ADD CONSTRAINT "ecritures_commande_id_commandes_id_fk" FOREIGN KEY ("commande_id") REFERENCES "public"."commandes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ecritures" ADD CONSTRAINT "ecritures_ligne_id_lignes_commande_id_fk" FOREIGN KEY ("ligne_id") REFERENCES "public"."lignes_commande"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ecritures" ADD CONSTRAINT "ecritures_entreprise_id_entreprises_id_fk" FOREIGN KEY ("entreprise_id") REFERENCES "public"."entreprises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "etablissements" ADD CONSTRAINT "etablissements_entreprise_id_entreprises_id_fk" FOREIGN KEY ("entreprise_id") REFERENCES "public"."entreprises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lignes_commande" ADD CONSTRAINT "lignes_commande_commande_id_commandes_id_fk" FOREIGN KEY ("commande_id") REFERENCES "public"."commandes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lignes_commande" ADD CONSTRAINT "lignes_commande_produit_id_produits_id_fk" FOREIGN KEY ("produit_id") REFERENCES "public"."produits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lignes_commande" ADD CONSTRAINT "lignes_commande_entreprise_id_entreprises_id_fk" FOREIGN KEY ("entreprise_id") REFERENCES "public"."entreprises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_expediteur_id_users_id_fk" FOREIGN KEY ("expediteur_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mouvements_stock" ADD CONSTRAINT "mouvements_stock_produit_id_produits_id_fk" FOREIGN KEY ("produit_id") REFERENCES "public"."produits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mouvements_stock" ADD CONSTRAINT "mouvements_stock_acteur_id_users_id_fk" FOREIGN KEY ("acteur_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "produits" ADD CONSTRAINT "produits_entreprise_id_entreprises_id_fk" FOREIGN KEY ("entreprise_id") REFERENCES "public"."entreprises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "produits" ADD CONSTRAINT "produits_etablissement_id_etablissements_id_fk" FOREIGN KEY ("etablissement_id") REFERENCES "public"."etablissements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "produits" ADD CONSTRAINT "produits_categorie_id_categories_id_fk" FOREIGN KEY ("categorie_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signalements_stock" ADD CONSTRAINT "signalements_stock_produit_id_produits_id_fk" FOREIGN KEY ("produit_id") REFERENCES "public"."produits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signalements_stock" ADD CONSTRAINT "signalements_stock_entreprise_id_entreprises_id_fk" FOREIGN KEY ("entreprise_id") REFERENCES "public"."entreprises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signalements_stock" ADD CONSTRAINT "signalements_stock_acteur_id_users_id_fk" FOREIGN KEY ("acteur_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signalements_stock" ADD CONSTRAINT "signalements_stock_decide_par_users_id_fk" FOREIGN KEY ("decide_par") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_niveaux" ADD CONSTRAINT "stock_niveaux_produit_id_produits_id_fk" FOREIGN KEY ("produit_id") REFERENCES "public"."produits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_commande_id_commandes_id_fk" FOREIGN KEY ("commande_id") REFERENCES "public"."commandes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_entreprise_id_entreprises_id_fk" FOREIGN KEY ("entreprise_id") REFERENCES "public"."entreprises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_user_produit_idx" ON "conversations" USING btree ("user_id","produit_id");--> statement-breakpoint
CREATE INDEX "ecritures_entreprise_idx" ON "ecritures" USING btree ("entreprise_id");--> statement-breakpoint
CREATE INDEX "otp_telephone_idx" ON "otp_codes" USING btree ("telephone");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");