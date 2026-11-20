// Montants en entiers FCFA. Aucun nombre à virgule pour l'argent.
import { badRequest } from './errors.ts';

export function assertFcfa(value: unknown, label = 'Montant'): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw badRequest(`${label} invalide : entier FCFA positif attendu`);
  }
  return value;
}

// Commission en points de base (1 % = 100). Arrondi à l'entier FCFA le plus proche.
export function commissionOf(amount: number, rateBps: number): number {
  return Math.round((amount * rateBps) / 10000);
}
