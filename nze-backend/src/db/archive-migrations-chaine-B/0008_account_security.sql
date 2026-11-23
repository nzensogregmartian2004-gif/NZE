ALTER TABLE "otp_codes" ALTER COLUMN "code" TYPE varchar(64);--> statement-breakpoint
ALTER TABLE "otp_codes" ADD COLUMN IF NOT EXISTS "purpose" varchar(20) DEFAULT 'verification' NOT NULL;--> statement-breakpoint
ALTER TABLE "otp_codes" ADD COLUMN IF NOT EXISTS "tentatives" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "langue" varchar(2) DEFAULT 'fr' NOT NULL;--> statement-breakpoint
-- Les codes OTP précédemment enregistrés en clair doivent être renouvelés.
UPDATE "otp_codes" SET "utilise" = true WHERE "utilise" = false;
