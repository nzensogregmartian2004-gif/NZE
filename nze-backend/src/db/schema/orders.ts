import { pgTable, uuid, integer, numeric, varchar, text, doublePrecision, pgEnum, timestamp } from "drizzle-orm/pg-core";
import { userActivities } from "./userActivities.js";
import { stores } from "./stores.js";
import { products } from "./products.js";

export const orderStatusEnum = pgEnum("order_status", [
  "nouvelle",
  "confirmee",
  "produit_pret",
  "terminee",
  "annulee",
]);

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientActivityId: uuid("client_activity_id")
    .notNull()
    .references(() => userActivities.id),
  storeId: uuid("store_id")
    .notNull()
    .references(() => stores.id),
  statut: orderStatusEnum("statut").notNull().default("nouvelle"),
  total: numeric("total", { precision: 12, scale: 2 }).notNull(),
  // Point de livraison, façon "adaptée au Gabon" (Phase 2 du prompt maître) :
  // GPS + indication libre plutôt qu'une adresse postale stricte.
  livraisonLatitude: doublePrecision("livraison_latitude"),
  livraisonLongitude: doublePrecision("livraison_longitude"),
  livraisonIndication: text("livraison_indication"),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  majLe: timestamp("maj_le", { withTimezone: true }).notNull().defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  quantite: integer("quantite").notNull(),
  prixUnitaire: numeric("prix_unitaire", { precision: 12, scale: 2 }).notNull(),
});

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
