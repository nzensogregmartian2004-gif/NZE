// Carte de livraison : calculs purs (cadrage, lecture de l'itinéraire Mapbox). Sans affichage.
export interface Coordonnees {
  latitude: number;
  longitude: number;
}

// Cadre englobant les points, au format attendu par la carte : coin nord-est et coin sud-ouest, en [longitude, latitude].
export function cadrageCarte(points: Coordonnees[]): { ne: [number, number]; sw: [number, number] } {
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const p of points) {
    minLat = Math.min(minLat, p.latitude);
    maxLat = Math.max(maxLat, p.latitude);
    minLon = Math.min(minLon, p.longitude);
    maxLon = Math.max(maxLon, p.longitude);
  }
  // Un seul point (client sans position livreur) : on ouvre un petit cadre autour de lui.
  if (maxLat - minLat < 0.002) { minLat -= 0.002; maxLat += 0.002; }
  if (maxLon - minLon < 0.002) { minLon -= 0.002; maxLon += 0.002; }
  return { ne: [maxLon, maxLat], sw: [minLon, minLat] };
}

// Trace de l'itinéraire renvoyée par l'API Directions de Mapbox (géométrie GeoJSON) : liste de [longitude, latitude].
export function extraireTrace(corps: unknown): [number, number][] | null {
  const coordonnees = (corps as { routes?: { geometry?: { coordinates?: unknown } }[] } | null)?.routes?.[0]?.geometry?.coordinates;
  if (!Array.isArray(coordonnees) || coordonnees.length < 2) return null;
  return coordonnees as [number, number][];
}

// Distance à vol d'oiseau entre deux points, en mètres (formule de Haversine).
export function ecartMetres(a: Coordonnees, b: Coordonnees): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// L'itinéraire n'est recalculé qu'après un déplacement d'au moins 100 m : moins d'appels à Mapbox, donc moins de coûts.
export function doitRecalculerTrace(ancienne: Coordonnees | null, nouvelle: Coordonnees, seuilM = 100): boolean {
  return ancienne === null || ecartMetres(ancienne, nouvelle) >= seuilM;
}

