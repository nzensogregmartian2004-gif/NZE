import { pgTable, uuid, varchar, text, integer, doublePrecision, pgEnum, timestamp, unique } from "drizzle-orm/pg-core";
import { serviceProfiles } from "./serviceProfiles.js";
import { categories } from "./categories.js";
import { users } from "./users.js";

export const postModerationStatusEnum = pgEnum("post_moderation_status", [
  "en_attente",
  "publie",
  "refuse",
]);

export const servicePosts = pgTable("service_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  serviceProfileId: uuid("service_profile_id")
    .notNull()
    .references(() => serviceProfiles.id, { onDelete: "cascade" }),
  titre: varchar("titre", { length: 150 }).notNull(),
  description: text("description"),
  categorieId: uuid("categorie_id").references(() => categories.id),
  localisationLatitude: doublePrecision("localisation_latitude"),
  localisationLongitude: doublePrecision("localisation_longitude"),
  statutModeration: postModerationStatusEnum("statut_moderation").notNull().default("en_attente"),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});

export const servicePostPhotos = pgTable("service_post_photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  postId: uuid("post_id")
    .notNull()
    .references(() => servicePosts.id, { onDelete: "cascade" }),
  url: varchar("url", { length: 500 }).notNull(),
  ordre: integer("ordre").notNull().default(0),
});

export const servicePostLikes = pgTable(
  "service_post_likes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => servicePosts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.postId, table.userId)]
);

export const servicePostComments = pgTable("service_post_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  postId: uuid("post_id")
    .notNull()
    .references(() => servicePosts.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  contenu: text("contenu").notNull(),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});

export type ServicePost = typeof servicePosts.$inferSelect;
