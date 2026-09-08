import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { conversations } from "./conversations.js";
import { users } from "./users.js";

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  senderId: uuid("sender_id")
    .notNull()
    .references(() => users.id),
  contenu: text("contenu").notNull(),
  envoyeLe: timestamp("envoye_le", { withTimezone: true }).notNull().defaultNow(),
  lu: boolean("lu").notNull().default(false),
});

export type Message = typeof messages.$inferSelect;
