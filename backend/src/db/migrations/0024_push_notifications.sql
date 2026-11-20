CREATE TABLE "appareils_push" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"jeton" text NOT NULL,
	"plateforme" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"mis_a_jour_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appareils_push_jeton_unique" UNIQUE("jeton"),
	CONSTRAINT "appareil_plateforme_chk" CHECK ("appareils_push"."plateforme" in ('android','ios'))
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "poussee_le" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "appareils_push" ADD CONSTRAINT "appareils_push_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appareils_push_user_idx" ON "appareils_push" USING btree ("user_id");