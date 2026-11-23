// Échéancier : libellés des statuts de mois et forme des données renvoyées par l'API.
import type { Cle } from '../i18n/dictionnaire';

export const CLES_STATUT_MOIS: Record<string, Cle> = {
  VALIDE: 'echeancier.statut.VALIDE',
  PARTIEL: 'echeancier.statut.PARTIEL',
  EN_RETARD: 'echeancier.statut.EN_RETARD',
  A_VENIR: 'echeancier.statut.A_VENIR',
};

export interface Echeancier {
  statut: string;
  articles: {
    echeancierId: string;
    nom: string;
    dureeMois: number;
    mois: { numero: number; montantDuFcfa: number; montantPayeFcfa: number; resteDuFcfa: number; dateLimite: string; statut: string }[];
    penalites: { moisRetard: number; montantFcfa: number; montantPayeFcfa: number; resteFcfa: number }[];
  }[];
}
