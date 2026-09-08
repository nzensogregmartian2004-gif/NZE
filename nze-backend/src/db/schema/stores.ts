import { pgTable, uuid, varchar, text, doublePrecision, jsonb, pgEnum, timestamp, integer } from "drizzle-orm/pg-core";
import { userActivities } from "./userActivities.js";

export const storeValidationStatusEnum = pgEnum("store_validation_status", [
  "en_attente",
  "valide",
  "suspendu",
  "refuse",
]);

export const stores = pgTable("stores", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Rattaché à l'activité "commercant", pas directement à l'utilisateur
  // (principe multi-activités défini en Phase 1).
  userActivityId: uuid("user_activity_id")
    .notNull()
    .references(() => userActivities.id, { onDelete: "cascade" }),
  nom: varchar("nom", { length: 150 }).notNull(),
  description: text("description"),
  photo: varchar("photo", { length: 500 }),
  couverture: varchar("couverture", { length: 500 }),
  // Position simplifiée en lat/lng (double precision) pour la Phase 2.
  // Migration possible vers un type "geography(Point,4326)" PostGIS plus tard
  // si le volume de données justifie des requêtes spatiales indexées (voir README).
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  adresseLibre: varchar("adresse_libre", { length: 255 }),
  quartier: varchar("quartier", { length: 100 }),
  horaires: jsonb("horaires").$type<Record<string, string>>(),
  statutValidation: storeValidationStatusEnum("statut_validation").notNull().default("en_attente"),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  majLe: timestamp("maj_le", { withTimezone: true }).notNull().defaultNow(),
});

export const storePhotos = pgTable("store_photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  storeId: uuid("store_id")
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  url: varchar("url", { length: 500 }).notNull(),
  ordre: integer("ordre").notNull().default(0),
});

export type Store = typeof stores.$inferSelect;
export type NewStore = typeof stores.$inferInsert;
