import { pgTable, uuid, varchar, doublePrecision, timestamp } from "drizzle-orm/pg-core";

/**
 * Position ponctuelle/temporaire d'une entité (livreur, chauffeur...).
 * Volontairement générique et minimal : pas d'historique conservé au-delà du
 * besoin opérationnel (une ligne = dernière position connue), conformément au
 * point 37 du prompt maître (ne pas enregistrer inutilement la position).
 * Remplacé par un flux WebSocket temps réel en Phase 6 ; ceci sert de solution
 * de repli par polling pour la Phase 3.
 */
export const locations = pgTable("locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  entiteType: varchar("entite_type", { length: 30 }).notNull(),
  entiteId: uuid("entite_id").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  majLe: timestamp("maj_le", { withTimezone: true }).notNull().defaultNow(),
});

export type Location = typeof locations.$inferSelect;
