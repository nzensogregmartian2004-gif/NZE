// Libellés du suivi de commande affiché au client (statuts renvoyés par l'API).
import type { Cle } from '../i18n/dictionnaire';

export const CLES_SUIVI: Record<string, Cle> = {
  CONFIRMEE: 'suivi.CONFIRMEE',
  EN_PREPARATION: 'suivi.EN_PREPARATION',
  PRETE: 'suivi.PRETE',
  EN_LIVRAISON: 'suivi.EN_LIVRAISON',
  LIVREE: 'suivi.LIVREE',
};
