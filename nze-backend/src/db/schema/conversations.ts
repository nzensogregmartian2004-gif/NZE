import { pgTable, uuid, pgEnum, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const conversationTypeEnum = pgEnum("conversation_type", ["directe", "annonce_admin"]);

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: conversationTypeEnum("type").notNull().default("directe"),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});

export const conversationParticipants = pgTable(
  "conversation_participants",
  {
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.conversationId, table.userId] })]
);

export type Conversation = typeof conversations.$inferSelect;
