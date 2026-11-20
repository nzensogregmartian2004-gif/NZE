CREATE TYPE "public"."delivery_proof_result" AS ENUM('livree', 'refusee');--> statement-breakpoint
CREATE TYPE "public"."refund_reason" AS ENUM('produit_non_fonctionnel', 'produit_non_conforme', 'non_recu', 'autre');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('en_attente_decision', 'remplacement_a_organiser', 'remboursement_a_executer', 'rembourse', 'refusee');--> statement-breakpoint
CREATE TABLE "delivery_proofs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"delivery_id" uuid NOT NULL,
	"deliverer_id" uuid NOT NULL,
	"resultat" "delivery_proof_result" NOT NULL,
	"signature" jsonb,
	"colis_conforme" boolean,
	"motif_refus" varchar(60),
	"enregistree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refund_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"client_activity_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"motif" "refund_reason" NOT NULL,
	"description" text,
	"montant_demande" numeric(12, 2) NOT NULL,
	"statut" "refund_status" DEFAULT 'en_attente_decision' NOT NULL,
	"decision_note" text,
	"decided_at" timestamp with time zone,
	"echeance_le" timestamp with time zone NOT NULL,
	"reference_virement" varchar(120),
	"confirme_le" timestamp with time zone,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"maj_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "delivery_proofs" ADD CONSTRAINT "delivery_proofs_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_proofs" ADD CONSTRAINT "delivery_proofs_deliverer_id_deliverers_id_fk" FOREIGN KEY ("deliverer_id") REFERENCES "public"."deliverers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_client_activity_id_user_activities_id_fk" FOREIGN KEY ("client_activity_id") REFERENCES "public"."user_activities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "delivery_proofs_delivery_idx" ON "delivery_proofs" USING btree ("delivery_id");--> statement-breakpoint
CREATE INDEX "refund_requests_order_idx" ON "refund_requests" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "refund_requests_statut_echeance_idx" ON "refund_requests" USING btree ("statut","echeance_le");--> statement-breakpoint
CREATE UNIQUE INDEX "refund_requests_open_per_order_idx" ON "refund_requests" USING btree ("order_id") WHERE "refund_requests"."statut" NOT IN ('refusee', 'rembourse');