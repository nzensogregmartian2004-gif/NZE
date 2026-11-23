// Suivi de livraison : étapes et avancement affichés au client. Logique pure, sans affichage.
export const ETAPES_SUIVI = ['CONFIRMEE', 'EN_PREPARATION', 'PRETE', 'EN_LIVRAISON', 'LIVREE'] as const;

export interface LivraisonClient {
  statut: string;
  positionMiseAJourLe: string | null;
  distanceRestanteMetres: number | null;
}

// Distance à partir de laquelle le livreur est « proche » : au-delà, la barre progresse lentement.
const DISTANCE_PROCHE_M = 2000;

// Avancement entre 0 et 1. Pendant la livraison, la barre avance selon la distance restante quand elle est connue.
export function avancement(suivi: string | null, distanceRestanteMetres: number | null): number {
  const i = suivi ? ETAPES_SUIVI.indexOf(suivi as (typeof ETAPES_SUIVI)[number]) : -1;
  if (i < 0) return 0;
  if (suivi === 'LIVREE') return 1;
  if (suivi === 'EN_LIVRAISON' && distanceRestanteMetres !== null) {
    const proche = 1 - Math.min(Math.max(distanceRestanteMetres, 0), DISTANCE_PROCHE_M) / DISTANCE_PROCHE_M;
    return Math.min(0.95, 0.75 + 0.2 * proche);
  }
  return i / (ETAPES_SUIVI.length - 1);
}
