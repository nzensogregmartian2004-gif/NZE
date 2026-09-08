import { pgTable, uuid, varchar, numeric, date, pgEnum, timestamp } from "drizzle-orm/pg-core";

export const adTargetTypeEnum = pgEnum("ad_target_type", ["produit", "magasin", "prestataire", "vehicule"]);

export const adStatusEnum = pgEnum("ad_status", ["en_attente", "active", "expiree", "refusee"]);

export const advertisements = pgTable("advertisements", {
  id: uuid("id").primaryKey().defaultRandom(),
  cibleType: adTargetTypeEnum("cible_type").notNull(),
  cibleId: uuid("cible_id").notNull(),
  prix: numeric("prix", { precision: 12, scale: 2 }).notNull(),
  emplacement: varchar("emplacement", { length: 100 }),
  dateDebut: date("date_debut").notNull(),
  dateFin: date("date_fin").notNull(),
  statut: adStatusEnum("statut").notNull().default("en_attente"),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});

export type Advertisement = typeof advertisements.$inferSelect;
