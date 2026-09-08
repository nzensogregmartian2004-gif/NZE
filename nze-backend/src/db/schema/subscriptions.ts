import { pgTable, uuid, varchar, numeric, integer, boolean, jsonb, pgEnum, timestamp } from "drizzle-orm/pg-core";
import { userActivities } from "./userActivities.js";

export const subscriptionPlans = pgTable("subscription_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  nom: varchar("nom", { length: 100 }).notNull(),
  prix: numeric("prix", { precision: 12, scale: 2 }).notNull(),
  dureeJours: integer("duree_jours").notNull(),
  fonctionnalites: jsonb("fonctionnalites").$type<string[]>(),
  actif: boolean("actif").notNull().default(true),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});

export const subscriptionStatusEnum = pgEnum("subscription_status", ["active", "expiree", "annulee"]);

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userActivityId: uuid("user_activity_id")
    .notNull()
    .references(() => userActivities.id, { onDelete: "cascade" }),
  planId: uuid("plan_id")
    .notNull()
    .references(() => subscriptionPlans.id),
  statut: subscriptionStatusEnum("statut").notNull().default("active"),
  expireLe: timestamp("expire_le", { withTimezone: true }).notNull(),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
