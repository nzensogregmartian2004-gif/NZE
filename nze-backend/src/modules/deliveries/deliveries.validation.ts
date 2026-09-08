import { z } from "zod";

export const createManualDeliverySchema = z.object({
  positionDepart: z.object({ latitude: z.number(), longitude: z.number() }),
  positionClient: z.object({ latitude: z.number(), longitude: z.number() }),
  typeLivraison: z.string().max(100),
  description: z.string().max(1000).optional(),
  remuneration: z.number().positive().optional(),
  instructions: z.string().max(1000).optional(),
});

export const assignDelivererSchema = z.object({
  delivererId: z.string().uuid(),
});

// Statuts que le livreur est autorisé à poser lui-même, dans l'ordre attendu.
export const LIVREUR_STATUS_SEQUENCE = [
  "acceptee",
  "en_route_vers_magasin",
  "arrive_au_magasin",
  "produit_recupere",
  "en_route_vers_client",
  "arrive_chez_client",
  "livraison_terminee",
] as const;

export const updateDeliveryStatusSchema = z.object({
  statut: z.enum([...LIVREUR_STATUS_SEQUENCE, "annulee"]),
});
