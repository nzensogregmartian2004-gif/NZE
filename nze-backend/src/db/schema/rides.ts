import { pgTable, uuid, doublePrecision, numeric, pgEnum, timestamp } from "drizzle-orm/pg-core";
import { userActivities } from "./userActivities.js";
import { drivers, driverServiceTypeEnum } from "./drivers.js";

export const rideStatusEnum = pgEnum("ride_status", [
  "demandee",
  "chauffeur_recherche",
  "acceptee",
  "en_cours",
  "terminee",
  "annulee",
]);

export const rides = pgTable("rides", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientActivityId: uuid("client_activity_id")
    .notNull()
    .references(() => userActivities.id),
  driverId: uuid("driver_id").references(() => drivers.id),
  typeService: driverServiceTypeEnum("type_service").notNull(),
  statut: rideStatusEnum("statut").notNull().default("demandee"),
  positionDepartLatitude: doublePrecision("position_depart_latitude").notNull(),
  positionDepartLongitude: doublePrecision("position_depart_longitude").notNull(),
  positionArriveeLatitude: doublePrecision("position_arrivee_latitude"),
  positionArriveeLongitude: doublePrecision("position_arrivee_longitude"),
  prixEstime: numeric("prix_estime", { precision: 12, scale: 2 }),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  majLe: timestamp("maj_le", { withTimezone: true }).notNull().defaultNow(),
});

export type Ride = typeof rides.$inferSelect;
export type NewRide = typeof rides.$inferInsert;
