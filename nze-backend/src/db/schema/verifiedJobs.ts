import { pgTable, uuid, text, date, pgEnum, timestamp } from "drizzle-orm/pg-core";
import { serviceProfiles } from "./serviceProfiles.js";
import { userActivities } from "./userActivities.js";

export const jobConfirmationStatusEnum = pgEnum("job_confirmation_status", [
  "en_attente",
  "confirmee",
  "refusee",
]);

export const verifiedJobs = pgTable("verified_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  serviceProfileId: uuid("service_profile_id")
    .notNull()
    .references(() => serviceProfiles.id, { onDelete: "cascade" }),
  clientActivityId: uuid("client_activity_id")
    .notNull()
    .references(() => userActivities.id),
  description: text("description").notNull(),
  datePrestation: date("date_prestation").notNull(),
  statutConfirmation: jobConfirmationStatusEnum("statut_confirmation").notNull().default("en_attente"),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});

export type VerifiedJob = typeof verifiedJobs.$inferSelect;
