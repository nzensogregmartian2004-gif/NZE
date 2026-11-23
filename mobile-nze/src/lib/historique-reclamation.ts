// Historique d'un dossier de réclamation (administration). Les actions sont journalisées côté serveur.
export interface EntreeHistorique {
  id: string;
  action: string;
  acteurId: string | null;
  acteurNom: string | null;
  details: unknown;
  creeLe: string;
}

export const ACTIONS_CONNUES = [
  'RECLAMATION_CREEE',
  'RECLAMATION_NOTE_AJOUTEE',
  'RECLAMATION_DECIDEE',
  'RECLAMATION_CLOTUREE',
  'RECLAMATION_EN_RETARD',
  'RECLAMATION_MISE_A_JOUR',
] as const;

// Clé de traduction du libellé d'une action (repli générique pour une action inconnue).
export function cleAction(action: string): string {
  return (ACTIONS_CONNUES as readonly string[]).includes(action) ? `historique.${action}` : 'historique.actionInconnue';
}

// Texte à afficher sous l'action : la note ou le motif, s'ils existent.
export function resumeDetails(details: unknown): string | null {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return null;
  const d = details as Record<string, unknown>;
  for (const cle of ['texte', 'motif']) {
    const valeur = d[cle];
    if (typeof valeur === 'string' && valeur.trim().length > 0) return valeur.trim();
  }
  return null;
}
