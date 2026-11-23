// Fiches prestataires (D-P6) : règles de saisie et libellés partagés par les écrans client et administration.
import type { Cle } from '../i18n/dictionnaire';

export const MOTIFS_DEMANDE = ['INFORMATION', 'DEVIS', 'AUTRE'] as const;
export type MotifDemande = (typeof MOTIFS_DEMANDE)[number];

export const MESSAGE_MINIMUM = 10;
export const MESSAGE_MAXIMUM = 2000;

export const LIBELLE_MOTIF_DEMANDE: Record<MotifDemande, Cle> = {
  INFORMATION: 'prestataires.motif.INFORMATION',
  DEVIS: 'prestataires.motif.DEVIS',
  AUTRE: 'prestataires.motif.AUTRE',
};

export const STATUTS_FICHE = ['BROUILLON', 'PUBLIEE', 'SUSPENDUE'] as const;
export type StatutFiche = (typeof STATUTS_FICHE)[number];
export const LIBELLE_STATUT_FICHE: Record<StatutFiche, Cle> = {
  BROUILLON: 'prestataires.statut.BROUILLON',
  PUBLIEE: 'prestataires.statut.PUBLIEE',
  SUSPENDUE: 'prestataires.statut.SUSPENDUE',
};

export const STATUTS_DEMANDE = ['NOUVELLE', 'TRAITEE', 'CLOTUREE'] as const;
export type StatutDemande = (typeof STATUTS_DEMANDE)[number];
export const LIBELLE_STATUT_DEMANDE: Record<StatutDemande, Cle> = {
  NOUVELLE: 'prestataires.statut.NOUVELLE',
  TRAITEE: 'prestataires.statut.TRAITEE',
  CLOTUREE: 'prestataires.statut.CLOTUREE',
};

// Un message est envoyable s'il contient entre 10 et 2000 caractères, espaces de bord non compris (règle de l'API).
export function messageValide(message: string): boolean {
  const n = message.trim().length;
  return n >= MESSAGE_MINIMUM && n <= MESSAGE_MAXIMUM;
}

// Nom public : 2 à 120 caractères ; activité : 2 à 80 caractères (règles de l'API).
export function ficheValide(nomPublic: string, activite: string): boolean {
  const nom = nomPublic.trim().length;
  const act = activite.trim().length;
  return nom >= 2 && nom <= 120 && act >= 2 && act <= 80;
}
