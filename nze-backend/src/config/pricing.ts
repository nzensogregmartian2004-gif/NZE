/**
 * Tarification des courses taxi/moto.
 *
 * ⚠️ Valeur fixée en dur pour l'instant (2000 FCFA les 15 km, demandé explicitement),
 * identique pour taxi et moto. Le point 28 du prompt maître demande que les prix
 * soient configurables depuis l'administration plutôt que codés en dur — cette
 * constante est donc un choix pragmatique pour la Phase 5/6, à migrer vers une
 * table de configuration admin (ex. `pricing_rules`) en Phase 7 sans changer la
 * logique de calcul elle-même.
 */
export const RIDE_PRICE_FCFA_PER_15KM = 2000;

/** Arrondi au multiple de 50 FCFA le plus proche (pratique pour le paiement mobile money). */
function roundToNearest50(value: number): number {
  return Math.round(value / 50) * 50;
}

export function computeRidePriceFcfa(distanceKm: number): number {
  const pricePerKm = RIDE_PRICE_FCFA_PER_15KM / 15;
  return roundToNearest50(distanceKm * pricePerKm);
}
