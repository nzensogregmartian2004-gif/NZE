// Libellés et types partagés par les écrans de commande et de réclamation (client et administration).
import type { Cle } from '../i18n/dictionnaire';

export const MOTIFS = ['ARTICLE_DEFECTUEUX', 'NON_CONFORME', 'DOMMAGE_LIVRAISON', 'ARTICLE_MANQUANT', 'AUTRE'] as const;
export type Motif = (typeof MOTIFS)[number];

export const STATUTS = ['OUVERTE', 'ACCEPTEE', 'REFUSEE', 'CLOTUREE'] as const;
export type Statut = (typeof STATUTS)[number];

const ROLES_ADMIN = ['admin_principal', 'admin_secondaire'];

// Seul le remplacement est proposé pour un article (décision de novembre 2026).
export const SOLUTION_ARTICLE = 'REMPLACEMENT';

export function estAdministration(role: string | undefined): boolean {
  return !!role && ROLES_ADMIN.includes(role);
}

export const LIBELLE_MOTIF: Record<Motif, Cle> = {
  ARTICLE_DEFECTUEUX: 'reclamation.motif.ARTICLE_DEFECTUEUX',
  NON_CONFORME: 'reclamation.motif.NON_CONFORME',
  DOMMAGE_LIVRAISON: 'reclamation.motif.DOMMAGE_LIVRAISON',
  ARTICLE_MANQUANT: 'reclamation.motif.ARTICLE_MANQUANT',
  AUTRE: 'reclamation.motif.AUTRE',
};

export const LIBELLE_STATUT: Record<Statut, Cle> = {
  OUVERTE: 'reclamation.statut.OUVERTE',
  ACCEPTEE: 'reclamation.statut.ACCEPTEE',
  REFUSEE: 'reclamation.statut.REFUSEE',
  CLOTUREE: 'reclamation.statut.CLOTUREE',
};

export const LIBELLE_SOLUTION: Record<string, Cle> = {
  REMPLACEMENT: 'reclamation.solution.REMPLACEMENT',
};

export const LIBELLE_STATUT_COMMANDE: Record<string, Cle> = {
  PANIER: 'commande.statut.PANIER',
  EN_ATTENTE_PAIEMENT: 'commande.statut.EN_ATTENTE_PAIEMENT',
  PAYEE: 'commande.statut.PAYEE',
  ECHEC: 'commande.statut.ECHEC',
  ANNULEE: 'commande.statut.ANNULEE',
};

export interface ClientVu { nom: string | null; telephone: string }

// Réclamation telle que renvoyée par l'API. `client` n'est présent que pour l'administration.
export interface Reclamation {
  id: string;
  reference: string;
  statut: Statut;
  motif: Motif;
  description: string;
  nomArticle: string;
  echeanceDecisionLe: string;
  enRetard: boolean;
  solution: string | null;
  motifDecision: string | null;
  decideLe: string | null;
  clotureLe: string | null;
  createdAt: string;
  client?: ClientVu;
}
