import { pgTable, uuid, integer, text, boolean, pgEnum, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const reviewTargetTypeEnum = pgEnum("review_target_type", [
  "magasin",
  "produit",
  "prestataire",
  "livreur",
  "chauffeur",
  "vehicule",
]);

export const reviews = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  auteurId: uuid("auteur_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  cibleType: reviewTargetTypeEnum("cible_type").notNull(),
  cibleId: uuid("cible_id").notNull(),
  note: integer("note").notNull(),
  commentaire: text("commentaire"),
  verifie: boolean("verifie").notNull().default(false),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});

export type Review = typeof reviews.$inferSelect;
