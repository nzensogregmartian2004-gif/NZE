import { pgTable, uuid, varchar, text, boolean, numeric, pgEnum, timestamp } from "drizzle-orm/pg-core";
import { userActivities } from "./userActivities.js";

export const serviceValidationStatusEnum = pgEnum("service_validation_status", [
  "en_attente",
  "valide",
  "refuse",
  "suspendu",
]);

export const serviceProfiles = pgTable("service_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userActivityId: uuid("user_activity_id")
    .notNull()
    .unique()
    .references(() => userActivities.id, { onDelete: "cascade" }),
  metier: varchar("metier", { length: 100 }).notNull(),
  zoneIntervention: varchar("zone_intervention", { length: 255 }),
  tarifIndicatif: varchar("tarif_indicatif", { length: 100 }),
  description: text("description"),
  disponible: boolean("disponible").notNull().default(true),
  statutValidation: serviceValidationStatusEnum("statut_validation").notNull().default("en_attente"),
  noteMoyenne: numeric("note_moyenne", { precision: 3, scale: 2 }),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  majLe: timestamp("maj_le", { withTimezone: true }).notNull().defaultNow(),
});

export const serviceSkills = pgTable("service_skills", {
  id: uuid("id").primaryKey().defaultRandom(),
  serviceProfileId: uuid("service_profile_id")
    .notNull()
    .references(() => serviceProfiles.id, { onDelete: "cascade" }),
  competence: varchar("competence", { length: 100 }).notNull(),
});

export type ServiceProfile = typeof serviceProfiles.$inferSelect;
export type NewServiceProfile = typeof serviceProfiles.$inferInsert;
