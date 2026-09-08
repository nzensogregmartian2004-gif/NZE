import { pgTable, uuid, varchar, text, integer, numeric, doublePrecision, boolean, jsonb, pgEnum, timestamp } from "drizzle-orm/pg-core";
import { userActivities } from "./userActivities.js";

export const vehicleTypeEnum = pgEnum("vehicle_type", [
  "voiture",
  "moto",
  "camionnette",
  "pick_up",
  "camion",
  "autre",
]);

export const vehicleValidationStatusEnum = pgEnum("vehicle_validation_status", [
  "en_attente",
  "valide",
  "refuse",
  "suspendu",
]);

export const vehicles = pgTable("vehicles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userActivityId: uuid("user_activity_id")
    .notNull()
    .references(() => userActivities.id, { onDelete: "cascade" }),
  type: vehicleTypeEnum("type").notNull(),
  marque: varchar("marque", { length: 100 }),
  modele: varchar("modele", { length: 100 }),
  annee: integer("annee"),
  capacite: varchar("capacite", { length: 100 }),
  description: text("description"),
  prix: numeric("prix", { precision: 12, scale: 2 }),
  conditionsLocation: text("conditions_location"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  disponibilite: jsonb("disponibilite").$type<{ debut: string; fin: string }[]>(),
  disponible: boolean("disponible").notNull().default(true),
  statutValidation: vehicleValidationStatusEnum("statut_validation").notNull().default("en_attente"),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  majLe: timestamp("maj_le", { withTimezone: true }).notNull().defaultNow(),
});

export const vehiclePhotos = pgTable("vehicle_photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  vehicleId: uuid("vehicle_id")
    .notNull()
    .references(() => vehicles.id, { onDelete: "cascade" }),
  url: varchar("url", { length: 500 }).notNull(),
  ordre: integer("ordre").notNull().default(0),
});

export type Vehicle = typeof vehicles.$inferSelect;
export type NewVehicle = typeof vehicles.$inferInsert;
