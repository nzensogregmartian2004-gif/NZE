ALTER TABLE "demandes_retrait" DROP CONSTRAINT "retrait_operateur_chk";--> statement-breakpoint
ALTER TABLE "demandes_retrait" ALTER COLUMN "numero" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "demandes_retrait" ADD CONSTRAINT "retrait_numero_chk" CHECK ("demandes_retrait"."operateur" = 'CARTE' or "demandes_retrait"."numero" is not null);--> statement-breakpoint
ALTER TABLE "demandes_retrait" ADD CONSTRAINT "retrait_operateur_chk" CHECK ("demandes_retrait"."operateur" in ('AIRTEL_MONEY','MOOV_MONEY','CARTE'));