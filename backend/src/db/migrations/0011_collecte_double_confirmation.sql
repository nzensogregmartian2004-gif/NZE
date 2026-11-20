-- Nouvelle validation de collecte : confirmation du commerçant puis validation définitive par l'administrateur principal.
ALTER TABLE "bordereaux"
  ADD COLUMN "partenaire_confirme_par" uuid,
  ADD COLUMN "partenaire_confirme_le" timestamp with time zone,
  ADD COLUMN "conteste_par" uuid,
  ADD COLUMN "conteste_le" timestamp with time zone,
  ADD COLUMN "motif_contestation" text,
  ADD COLUMN "valide_par" uuid,
  ADD COLUMN "valide_le" timestamp with time zone,
  ADD COLUMN "motif_refus" text;
--> statement-breakpoint
ALTER TABLE "bordereaux" DROP CONSTRAINT "bordereaux_statut_chk";
--> statement-breakpoint
-- Les anciens bordereaux étaient déjà considérés comme collectés dans la version précédente.
UPDATE "bordereaux" SET "statut" = 'VALIDE' WHERE "statut" IN ('COLLECTE', 'ANOMALIE');
--> statement-breakpoint
ALTER TABLE "bordereaux" ADD CONSTRAINT "bordereaux_statut_chk"
  CHECK ("statut" in ('ATTENTE_PARTENAIRE','ATTENTE_VALIDATION_NZE','CONTESTE','VALIDE','REFUSE','ANNULE'));
--> statement-breakpoint
ALTER TABLE "bordereaux" ADD CONSTRAINT "bordereaux_partenaire_confirme_par_users_id_fk"
  FOREIGN KEY ("partenaire_confirme_par") REFERENCES "users"("id");
--> statement-breakpoint
ALTER TABLE "bordereaux" ADD CONSTRAINT "bordereaux_conteste_par_users_id_fk"
  FOREIGN KEY ("conteste_par") REFERENCES "users"("id");
--> statement-breakpoint
ALTER TABLE "bordereaux" ADD CONSTRAINT "bordereaux_valide_par_users_id_fk"
  FOREIGN KEY ("valide_par") REFERENCES "users"("id");
