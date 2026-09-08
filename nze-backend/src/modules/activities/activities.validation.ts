import { z } from "zod";

// Types d'activités qui deviennent automatiquement "active" sans validation admin
export const AUTO_VALIDATED_TYPES = ["client"] as const;

export const createActivitySchema = z.object({
  type: z.enum([
    "client",
    "commercant",
    "prestataire",
    "livreur",
    "chauffeur",
    "proprietaire_vehicule",
  ]),
  // Champs spécifiques à l'activité (nom du magasin, métier, type de véhicule...).
  // Structure libre en Phase 1 ; sera formalisé par des tables dédiées en Phase 2+.
  metadonnees: z.record(z.unknown()).optional(),
});

export const updateActivitySchema = z.object({
  metadonnees: z.record(z.unknown()).optional(),
});
