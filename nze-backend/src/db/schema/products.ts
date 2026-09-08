import { pgTable, uuid, varchar, text, numeric, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { stores } from "./stores.js";
import { categories } from "./categories.js";

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  storeId: uuid("store_id")
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  nom: varchar("nom", { length: 150 }).notNull(),
  description: text("description"),
  prix: numeric("prix", { precision: 12, scale: 2 }).notNull(),
  categorieId: uuid("categorie_id").references(() => categories.id),
  stock: integer("stock").notNull().default(0),
  disponible: boolean("disponible").notNull().default(true),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  majLe: timestamp("maj_le", { withTimezone: true }).notNull().defaultNow(),
});

export const productPhotos = pgTable("product_photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  url: varchar("url", { length: 500 }).notNull(),
  ordre: integer("ordre").notNull().default(0),
});

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
