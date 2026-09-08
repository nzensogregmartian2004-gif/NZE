import { pgTable, uuid, varchar, boolean, pgEnum, timestamp } from "drizzle-orm/pg-core";
import { userActivities } from "./userActivities.js";
import { vehicles } from "./vehicles.js";

export const driverServiceTypeEnum = pgEnum("driver_service_type", ["taxi", "moto"]);

export const driverValidationStatusEnum = pgEnum("driver_validation_status", [
  "en_attente",
  "valide",
  "refuse",
  "suspendu",
]);

export const drivers = pgTable("drivers", {
  id: uuid("id").primaryKey().defaultRandom(),
  userActivityId: uuid("user_activity_id")
    .notNull()
    .unique()
    .references(() => userActivities.id, { onDelete: "cascade" }),
  vehicleId: uuid("vehicle_id").references(() => vehicles.id),
  typeService: driverServiceTypeEnum("type_service").notNull(),
  disponible: boolean("disponible").notNull().default(false),
  statutValidation: driverValidationStatusEnum("statut_validation").notNull().default("en_attente"),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  majLe: timestamp("maj_le", { withTimezone: true }).notNull().defaultNow(),
});

export type Driver = typeof drivers.$inferSelect;
export type NewDriver = typeof drivers.$inferInsert;
