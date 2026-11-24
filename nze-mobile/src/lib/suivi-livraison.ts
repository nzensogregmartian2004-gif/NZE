// Suivi de livraison : étapes et avancement affichés au client. Logique pure, sans affichage.
export const ETAPES_SUIVI = ['CONFIRMEE', 'EN_PREPARATION', 'PRETE', 'EN_LIVRAISON', 'LIVREE'] as const;

export interface LivraisonClient {
  statut: string;
  positionMiseAJourLe: string | null;
  distanceRestanteMetres: number | null;
  livreur: { latitude: number; longitude: number } | null;
  destination: { latitude: number; longitude: number } | null;
}

// Une position du livreur reste « récente » pendant 2 minutes après sa dernière transmission.
const SEUIL_FRAICHEUR_MS = 2 * 60 * 1000;

export function fraicheurPosition(positionMiseAJourLe: string | null, maintenant: Date): { etat: 'RECENTE' | 'ANCIENNE' | 'INCONNUE'; minutes: number } {
  if (!positionMiseAJourLe) return { etat: 'INCONNUE', minutes: 0 };
  const ecart = maintenant.getTime() - new Date(positionMiseAJourLe).getTime();
  if (Number.isNaN(ecart)) return { etat: 'INCONNUE', minutes: 0 };
  return { etat: ecart <= SEUIL_FRAICHEUR_MS ? 'RECENTE' : 'ANCIENNE', minutes: Math.max(0, Math.round(ecart / 60000)) };
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
