CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"destinataire_id" uuid NOT NULL,
	"type" text NOT NULL,
	"titre" text NOT NULL,
	"message" text NOT NULL,
	"cible_type" text,
	"cible_id" text,
	"lue_le" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "otp_codes" ADD COLUMN "ip" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_destinataire_id_users_id_fk" FOREIGN KEY ("destinataire_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_destinataire_idx" ON "notifications" USING btree ("destinataire_id","created_at");--> statement-breakpoint
CREATE INDEX "otp_ip_idx" ON "otp_codes" USING btree ("ip","created_at");