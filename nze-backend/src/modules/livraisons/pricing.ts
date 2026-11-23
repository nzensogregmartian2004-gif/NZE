// Frais de livraison : distance depuis le point fixe NZE × tarif au kilomètre, avec minimum.
// Provisoire : distance à vol d'oiseau. La distance routière sera branchée avec le fournisseur cartographique.
export interface Point { latitude: number; longitude: number }

const RAYON_TERRE_M = 6371000;

export function distanceMetres(a: Point, b: Point): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * RAYON_TERRE_M * Math.asin(Math.sqrt(h)));
}

export function fraisLivraison(distanceM: number, tarif: { fcfaParKm: number; minimumFcfa: number }): number {
  const km = distanceM / 1000;
  return Math.max(tarif.minimumFcfa, Math.ceil(km * tarif.fcfaParKm));
}

export function validerPoint(p: Point): Point {
  if (!Number.isFinite(p.latitude) || p.latitude < -90 || p.latitude > 90) throw new Error('Latitude invalide');
  if (!Number.isFinite(p.longitude) || p.longitude < -180 || p.longitude > 180) throw new Error('Longitude invalide');
  return p;
}
