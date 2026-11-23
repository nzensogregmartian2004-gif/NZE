import { appeler } from '../api/client';

// Réglages de messagerie (cahier V3.0 §17.1) : alerte à chaque message reçu de NZE.
export interface ReglagesMessagerie { notifMessages: boolean }

export function lireReglagesMessagerie() {
  return appeler<ReglagesMessagerie>('/messagerie/preferences');
}

export function enregistrerReglagesMessagerie(notifMessages: boolean) {
  return appeler<ReglagesMessagerie>('/messagerie/preferences', { methode: 'PATCH', corps: { notifMessages } });
}
