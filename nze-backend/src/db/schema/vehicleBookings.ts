import { pgTable, uuid, date, text, pgEnum, timestamp } from "drizzle-orm/pg-core";
import { vehicles } from "./vehicles.js";
import { userActivities } from "./userActivities.js";

export const bookingStatusEnum = pgEnum("booking_status", [
  "demandee",
  "acceptee",
  "refusee",
  "terminee",
  "annulee",
]);

export const vehicleBookings = pgTable("vehicle_bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  vehicleId: uuid("vehicle_id")
    .notNull()
    .references(() => vehicles.id),
  clientActivityId: uuid("client_activity_id")
    .notNull()
    .references(() => userActivities.id),
  dateDebut: date("date_debut").notNull(),
  dateFin: date("date_fin").notNull(),
  statut: bookingStatusEnum("statut").notNull().default("demandee"),
  message: text("message"),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});

export type VehicleBooking = typeof vehicleBookings.$inferSelect;
