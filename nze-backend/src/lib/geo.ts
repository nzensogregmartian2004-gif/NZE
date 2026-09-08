import { sql, type SQL } from "drizzle-orm";
import { stores } from "../db/schema/index.js";

/**
 * Expression SQL calculant la distance en kilomètres entre un point (lat, lng)
 * donné et la position d'un magasin, via la formule de Haversine.
 *
 * Choix pragmatique pour la Phase 2 (pas besoin de l'extension PostGIS pour un
 * volume de données modeste). À remplacer par des requêtes PostGIS
 * (ST_DWithin/ST_Distance + index GIST) si le nombre de magasins/produits
 * grandit significativement — voir la note dans le README.
 */
export function distanceKmExpr(lat: number, lng: number): SQL<number> {
  return sql<number>`(
    6371 * acos(
      cos(radians(${lat})) * cos(radians(${stores.latitude})) *
      cos(radians(${stores.longitude}) - radians(${lng})) +
      sin(radians(${lat})) * sin(radians(${stores.latitude}))
    )
  )`;
}
