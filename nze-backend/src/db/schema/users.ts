import { pgTable, uuid, varchar, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const userStatusEnum = pgEnum("user_status", ["actif", "suspendu", "supprime"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  nom: varchar("nom", { length: 100 }).notNull(),
  prenom: varchar("prenom", { length: 100 }).notNull(),
  telephone: varchar("telephone", { length: 20 }).notNull().unique(),
  telephoneVerifie: boolean("telephone_verifie").notNull().default(false),
  email: varchar("email", { length: 255 }).unique(),
  motDePasseHash: varchar("mot_de_passe_hash", { length: 255 }).notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
  statut: userStatusEnum("statut").notNull().default("actif"),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  majLe: timestamp("maj_le", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
