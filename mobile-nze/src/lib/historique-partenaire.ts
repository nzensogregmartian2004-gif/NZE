// Historique du partenaire : répartition du stock et correspondance des statuts. Pur, sans affichage.
import type { Cle } from '../i18n/dictionnaire';

export interface ProduitStock { id: string; nom: string; disponible: number | null; etat?: string }

// Un article est en rupture quand il ne reste plus rien (quantité absente ou nulle).
export function enRupture(disponible: number | null | undefined): boolean {
  return (disponible ?? 0) <= 0;
}

export function repartirStock<T extends { disponible: number | null }>(produits: T[]): { enStock: T[]; enRupture: T[] } {
  return {
    enStock: produits.filter((p) => !enRupture(p.disponible)),
    enRupture: produits.filter((p) => enRupture(p.disponible)),
  };
}

// Libellés des statuts renvoyés par l'API (collectes : bordereaux ; retraits : demandes de retrait).
export const CLES_STATUT_COLLECTE: Record<string, Cle> = {
  ATTENTE_PARTENAIRE: 'partHist.s.ATTENTE_PARTENAIRE',
  ATTENTE_VALIDATION_NZE: 'partHist.s.ATTENTE_VALIDATION_NZE',
  CONTESTE: 'partHist.s.CONTESTE',
  VALIDE: 'partHist.s.VALIDE',
  REFUSE: 'partHist.s.REFUSE',
  ANNULE: 'partHist.s.ANNULE',
};

export const CLES_STATUT_RETRAIT: Record<string, Cle> = {
  EN_ATTENTE: 'partHist.s.EN_ATTENTE',
  VERSEMENT_EN_COURS: 'partHist.s.VERSEMENT_EN_COURS',
  VERSEE: 'partHist.s.VERSEE',
  REJETEE: 'partHist.s.REJETEE',
  ECHEC: 'partHist.s.ECHEC',
};
