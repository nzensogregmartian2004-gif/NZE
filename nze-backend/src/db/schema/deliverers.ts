import { pgTable, uuid, varchar, boolean, jsonb, pgEnum, timestamp } from "drizzle-orm/pg-core";
import { userActivities } from "./userActivities.js";

export const delivererValidationStatusEnum = pgEnum("deliverer_validation_status", [
  "en_attente",
  "valide",
  "refuse",
  "suspendu",
]);

export const deliverers = pgTable("deliverers", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Un livreur = une activité "livreur" (Phase 1), enrichie ici des infos spécifiques.
  userActivityId: uuid("user_activity_id")
    .notNull()
    .unique()
    .references(() => userActivities.id, { onDelete: "cascade" }),
  typeVehicule: varchar("type_vehicule", { length: 50 }).notNull(),
  vehiculeInfos: jsonb("vehicule_infos").$type<Record<string, unknown>>(),
  documents: jsonb("documents").$type<string[]>(),
  disponible: boolean("disponible").notNull().default(false),
  statutValidation: delivererValidationStatusEnum("statut_validation").notNull().default("en_attente"),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  majLe: timestamp("maj_le", { withTimezone: true }).notNull().defaultNow(),
});

export type Deliverer = typeof deliverers.$inferSelect;
export type NewDeliverer = typeof deliverers.$inferInsert;
