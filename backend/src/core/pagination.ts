// Pagination des listes. Chaque liste renvoie une page (limite, décalage) : aucune liste ne tronque plus en silence.
import { z } from 'zod';

export const LIMITE_MAX = 200;

export interface Page { limite: number; decalage: number }

// Champs de requête communs : taille de page (défaut propre à chaque liste, plafonné à LIMITE_MAX) et décalage.
export function champsPage(limiteDefaut: number) {
  return {
    limite: z.coerce.number().int().min(1).max(LIMITE_MAX).default(Math.min(limiteDefaut, LIMITE_MAX)),
    decalage: z.coerce.number().int().min(0).max(1_000_000).default(0),
  };
}
