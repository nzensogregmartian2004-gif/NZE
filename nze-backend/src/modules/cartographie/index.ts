// Cartographie (décision 18 : Google Maps). Distance routière entre le point de départ et le client,
// base des frais de livraison (cahier §13.2). La clé est côté serveur uniquement : elle n'apparaît jamais dans un message d'erreur.
// Règle : pas de distance routière, pas de commande. Aucun repli silencieux sur la ligne droite en production.
import { AppError } from '../../core/errors.ts';
import { distanceMetres, type Point } from '../livraisons/pricing.ts';

export interface TrajetRoutier {
  distanceM: number;
  dureeS: number | null;
}

export interface Cartographie {
  readonly fournisseur: string;
  distanceRoutiere(origine: Point, destination: Point): Promise<TrajetRoutier>;
}

export const adresseHorsReseau = (): AppError =>
  new AppError(422, 'ADRESSE_HORS_RESEAU', 'Cette adresse n’est pas accessible par la route depuis le point de départ. Vérifiez le repère ou choisissez une autre adresse.');

export const cartographieIndisponible = (): AppError =>
  new AppError(503, 'CARTOGRAPHIE_INDISPONIBLE', 'Le calcul de la distance est momentanément indisponible. Réessayez dans quelques instants.');

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

// Développement uniquement : ligne droite, marquée comme telle dans chaque commande. Interdite en production.
export class EstimationVolOiseau implements Cartographie {
  readonly fournisseur = 'ESTIMATION_VOL_OISEAU';
  async distanceRoutiere(origine: Point, destination: Point): Promise<TrajetRoutier> {
    return { distanceM: distanceMetres(origine, destination), dureeS: null };
  }
}

interface ElementRoutes {
  condition?: string;
  distanceMeters?: number;
  duration?: string;
}

// Google Routes API (matrice de distances, mode voiture). Une origine et une destination par appel.
// La clé est envoyée dans un en-tête, jamais dans l'adresse de la requête.
export class GoogleMapsClient implements Cartographie {
  readonly fournisseur = 'GOOGLE_MAPS';
  // Déclaration explicite : le mode « suppression de types » de Node n'accepte pas les propriétés de paramètre.
  private readonly opts: { cle: string; fetch?: FetchLike; timeoutMs?: number };
  constructor(opts: { cle: string; fetch?: FetchLike; timeoutMs?: number }) {
    this.opts = opts;
  }

  async distanceRoutiere(origine: Point, destination: Point): Promise<TrajetRoutier> {
    const point = (p: Point) => ({ waypoint: { location: { latLng: { latitude: p.latitude, longitude: p.longitude } } } });
    let reponse: Response;
    try {
      reponse = await (this.opts.fetch ?? fetch)('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.opts.cle,
          'X-Goog-FieldMask': 'originIndex,destinationIndex,distanceMeters,duration,condition',
        },
        body: JSON.stringify({
          origins: [point(origine)],
          destinations: [point(destination)],
          travelMode: 'DRIVE',
          languageCode: 'fr-FR',
        }),
        signal: AbortSignal.timeout(this.opts.timeoutMs ?? 8000),
      });
    } catch {
      // Le message d'erreur ne reprend ni l'adresse ni la clé.
      throw cartographieIndisponible();
    }
    if (!reponse.ok) throw cartographieIndisponible();
    const elements = (await reponse.json().catch(() => null)) as ElementRoutes[] | null;
    const element = Array.isArray(elements) ? elements[0] : undefined;
    if (!element) throw cartographieIndisponible();
    if (element.condition === 'ROUTE_NOT_FOUND') throw adresseHorsReseau();
    if (element.condition !== 'ROUTE_EXISTS' || element.distanceMeters === undefined) throw cartographieIndisponible();
    return {
      distanceM: Math.round(element.distanceMeters),
      dureeS: element.duration ? Math.round(Number(element.duration.replace(/s$/, ''))) : null,
    };
  }
}

// Mapbox Matrix API (Directions Matrix v1, profil voiture). Les coordonnées sont envoyées en longitude,latitude.
// Le jeton est passé dans l'adresse, comme l'exige l'API : il n'apparaît jamais dans un message d'erreur.
interface ReponseMapbox {
  code?: string;
  durations?: (number | null)[][];
  distances?: (number | null)[][];
}

export class MapboxClient implements Cartographie {
  readonly fournisseur = 'MAPBOX';
  // Déclaration explicite : le mode « suppression de types » de Node n'accepte pas les propriétés de paramètre.
  private readonly opts: { cle: string; fetch?: FetchLike; timeoutMs?: number };
  constructor(opts: { cle: string; fetch?: FetchLike; timeoutMs?: number }) {
    this.opts = opts;
  }

  async distanceRoutiere(origine: Point, destination: Point): Promise<TrajetRoutier> {
    const coordonnees = `${origine.longitude},${origine.latitude};${destination.longitude},${destination.latitude}`;
    const url = new URL(`https://api.mapbox.com/directions-matrix/v1/mapbox/driving/${coordonnees}`);
    url.searchParams.set('annotations', 'distance,duration');
    url.searchParams.set('access_token', this.opts.cle);
    let reponse: Response;
    try {
      reponse = await (this.opts.fetch ?? fetch)(url, { signal: AbortSignal.timeout(this.opts.timeoutMs ?? 8000) });
    } catch {
      // Le message d'erreur ne reprend ni l'adresse ni le jeton.
      throw cartographieIndisponible();
    }
    if (!reponse.ok) throw cartographieIndisponible();
    const corps = (await reponse.json().catch(() => null)) as ReponseMapbox | null;
    if (!corps || corps.code !== 'Ok') throw cartographieIndisponible();
    // Matrice 2x2 : la ligne 0 est l'origine, la colonne 1 la destination.
    const distance = corps.distances?.[0]?.[1];
    if (distance === null) throw adresseHorsReseau();
    if (typeof distance !== 'number') throw cartographieIndisponible();
    const duree = corps.durations?.[0]?.[1];
    return {
      distanceM: Math.round(distance),
      dureeS: typeof duree === 'number' ? Math.round(duree) : null,
    };
  }
}

// Choix du fournisseur depuis l'environnement. Mapbox par défaut ; l'estimation à vol d'oiseau est refusée en production.
export function chargerCartographie(env: Record<string, string | undefined>, appEnv: string): Cartographie {
  const choix = env.CARTOGRAPHIE ?? 'mapbox';
  if (choix === 'estimation') {
    if (appEnv === 'production') {
      throw new Error('CARTOGRAPHIE=estimation est interdit en production : le tarif doit reposer sur une distance routière');
    }
    return new EstimationVolOiseau();
  }
  if (choix === 'mapbox') {
    const jeton = env.MAPBOX_ACCESS_TOKEN;
    if (!jeton) throw new Error('MAPBOX_ACCESS_TOKEN requis pour CARTOGRAPHIE=mapbox');
    return new MapboxClient({ cle: jeton });
  }
  if (choix !== 'google') throw new Error('CARTOGRAPHIE doit valoir mapbox, google ou estimation');
  const cle = env.GOOGLE_MAPS_API_KEY;
  if (!cle) throw new Error('GOOGLE_MAPS_API_KEY requis pour CARTOGRAPHIE=google');
  return new GoogleMapsClient({ cle });
}
