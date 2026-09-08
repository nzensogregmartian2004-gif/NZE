import { pgTable, uuid, timestamp, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { users } from "./users.js";

// Types d'activités possibles pour un compte NZE
export const activityTypeEnum = pgEnum("activity_type", [
  "client",
  "commercant",
  "prestataire",
  "livreur",
  "chauffeur",
  "proprietaire_vehicule",
]);

// Statut de validation d'une activité (le client est actif immédiatement,
// les autres passent par une validation admin)
export const activityStatusEnum = pgEnum("activity_status", [
  "active",
  "en_attente",
  "refusee",
  "suspendue",
]);

export const userActivities = pgTable("user_activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: activityTypeEnum("type").notNull(),
  statut: activityStatusEnum("statut").notNull().default("en_attente"),
  // Champs spécifiques à l'activité en attendant les tables dédiées
  // (store, service_profile, vehicle...) des phases suivantes.
  metadonnees: jsonb("metadonnees").$type<Record<string, unknown>>(),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  majLe: timestamp("maj_le", { withTimezone: true }).notNull().defaultNow(),
});

export type UserActivity = typeof userActivities.$inferSelect;
export type NewUserActivity = typeof userActivities.$inferInsert;
