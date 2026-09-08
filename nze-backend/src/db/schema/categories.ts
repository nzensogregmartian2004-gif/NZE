import { pgTable, uuid, varchar, pgEnum, timestamp } from "drizzle-orm/pg-core";

export const categoryTypeEnum = pgEnum("category_type", ["produit", "service"]);

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  nom: varchar("nom", { length: 100 }).notNull(),
  type: categoryTypeEnum("type").notNull(),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});

export type Category = typeof categories.$inferSelect;
