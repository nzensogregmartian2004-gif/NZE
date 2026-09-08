import { pgTable, uuid, varchar, text, numeric, doublePrecision, pgEnum, timestamp } from "drizzle-orm/pg-core";
import { orders } from "./orders.js";
import { deliverers } from "./deliverers.js";

// Statuts définis point 10 du prompt maître NZE
export const deliveryStatusEnum = pgEnum("delivery_status", [
  "nouvelle",
  "en_attente",
  "livreur_recherche",
  "livreur_attribue",
  "acceptee",
  "en_route_vers_magasin",
  "arrive_au_magasin",
  "produit_recupere",
  "en_route_vers_client",
  "arrive_chez_client",
  "livraison_terminee",
  "annulee",
]);

export const deliveries = pgTable("deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Nullable : une mission peut être créée manuellement par l'admin sans commande
  // (ex. livraison de meubles), pas seulement générée depuis une order.
  orderId: uuid("order_id").references(() => orders.id),
  delivererId: uuid("deliverer_id").references(() => deliverers.id),
  statut: deliveryStatusEnum("statut").notNull().default("nouvelle"),
  positionDepartLatitude: doublePrecision("position_depart_latitude"),
  positionDepartLongitude: doublePrecision("position_depart_longitude"),
  positionClientLatitude: doublePrecision("position_client_latitude"),
  positionClientLongitude: doublePrecision("position_client_longitude"),
  typeLivraison: varchar("type_livraison", { length: 100 }),
  description: text("description"),
  remuneration: numeric("remuneration", { precision: 12, scale: 2 }),
  instructions: text("instructions"),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  majLe: timestamp("maj_le", { withTimezone: true }).notNull().defaultNow(),
});

export type Delivery = typeof deliveries.$inferSelect;
export type NewDelivery = typeof deliveries.$inferInsert;
