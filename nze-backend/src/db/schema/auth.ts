import { pgTable, uuid, varchar, timestamp, boolean } from "drizzle-orm/pg-core";
import { users } from "./users.js";

// Codes OTP envoyés par SMS pour vérifier le numéro de téléphone
export const otpCodes = pgTable("otp_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  telephone: varchar("telephone", { length: 20 }).notNull(),
  code: varchar("code", { length: 10 }).notNull(),
  expireLe: timestamp("expire_le", { withTimezone: true }).notNull(),
  utilise: boolean("utilise").notNull().default(false),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});

// Refresh tokens actifs, pour permettre la révocation de session
export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 255 }).notNull(),
  revoque: boolean("revoque").notNull().default(false),
  expireLe: timestamp("expire_le", { withTimezone: true }).notNull(),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});

export type OtpCode = typeof otpCodes.$inferSelect;
export type RefreshToken = typeof refreshTokens.$inferSelect;
