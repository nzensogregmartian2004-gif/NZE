import { pgTable, uuid, numeric, varchar, pgEnum, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const paymentTypeEnum = pgEnum("payment_type", ["abonnement", "publicite", "autre"]);
export const paymentStatusEnum = pgEnum("payment_status", ["en_attente", "reussi", "echoue"]);

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  montant: numeric("montant", { precision: 12, scale: 2 }).notNull(),
  type: paymentTypeEnum("type").notNull(),
  statut: paymentStatusEnum("statut").notNull().default("en_attente"),
  reference: varchar("reference", { length: 100 }),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});

export type Payment = typeof payments.$inferSelect;
