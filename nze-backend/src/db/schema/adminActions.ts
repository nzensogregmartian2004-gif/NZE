import { pgTable, uuid, varchar, text, pgEnum, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const adminActions = pgTable("admin_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminId: uuid("admin_id")
    .notNull()
    .references(() => users.id),
  action: varchar("action", { length: 100 }).notNull(),
  cibleType: varchar("cible_type", { length: 50 }),
  cibleId: uuid("cible_id"),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});

export const reportStatusEnum = pgEnum("report_status", ["en_attente", "traite", "rejete"]);

export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  auteurId: uuid("auteur_id")
    .notNull()
    .references(() => users.id),
  cibleType: varchar("cible_type", { length: 50 }).notNull(),
  cibleId: uuid("cible_id").notNull(),
  motif: text("motif").notNull(),
  statut: reportStatusEnum("statut").notNull().default("en_attente"),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});

export type AdminAction = typeof adminActions.$inferSelect;
export type Report = typeof reports.$inferSelect;
