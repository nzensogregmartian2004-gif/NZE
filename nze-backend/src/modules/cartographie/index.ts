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

interface ElementMatrice {
  status: string;
  distance?: { value: number };
  duration?: { value: number };
}

// Google Distance Matrix (mode voiture). Le statut global indique un problème de configuration ou de quota,
// le statut de l'élément indique une adresse sans route.
export class GoogleMapsClient implements Cartographie {
  readonly fournisseur = 'GOOGLE_MAPS';
  // Déclaration explicite : le mode « suppression de types » de Node n'accepte pas les propriétés de paramètre.
  private readonly opts: { cle: string; fetch?: FetchLike; timeoutMs?: number };
  constructor(opts: { cle: string; fetch?: FetchLike; timeoutMs?: number }) {
    this.opts = opts;
  }

  async distanceRoutiere(origine: Point, destination: Point): Promise<TrajetRoutier> {
    const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
    url.searchParams.set('origins', `${origine.latitude},${origine.longitude}`);
    url.searchParams.set('destinations', `${destination.latitude},${destination.longitude}`);
    url.searchParams.set('mode', 'driving');
    url.searchParams.set('language', 'fr');
    url.searchParams.set('units', 'metric');
    url.searchParams.set('key', this.opts.cle);
    let reponse: Response;
    try {
      reponse = await (this.opts.fetch ?? fetch)(url, { signal: AbortSignal.timeout(this.opts.timeoutMs ?? 8000) });
    } catch {
      // Le message d'erreur ne reprend ni l'URL ni la clé.
      throw cartographieIndisponible();
    }
    if (!reponse.ok) throw cartographieIndisponible();
    const corps = (await reponse.json().catch(() => null)) as { status?: string; rows?: { elements?: ElementMatrice[] }[] } | null;
    if (!corps || corps.status !== 'OK') throw cartographieIndisponible();
    const element = corps.rows?.[0]?.elements?.[0];
    if (!element) throw cartographieIndisponible();
    if (element.status === 'ZERO_RESULTS' || element.status === 'NOT_FOUND') throw adresseHorsReseau();
    if (element.status !== 'OK' || !element.distance) throw cartographieIndisponible();
    return {
      distanceM: Math.round(element.distance.value),
      dureeS: element.duration ? Math.round(element.duration.value) : null,
    };
  }
}

// Choix du fournisseur depuis l'environnement. En production, seul Google est accepté.
export function chargerCartographie(env: Record<string, string | undefined>, appEnv: string): Cartographie {
  const choix = env.CARTOGRAPHIE ?? 'google';
  if (choix === 'estimation') {
    if (appEnv === 'production') {
      throw new Error('CARTOGRAPHIE=estimation est interdit en production : le tarif doit reposer sur une distance routière');
    }
    return new EstimationVolOiseau();
  }
  if (choix !== 'google') throw new Error('CARTOGRAPHIE doit valoir google ou estimation');
  const cle = env.GOOGLE_MAPS_API_KEY;
  if (!cle) throw new Error('GOOGLE_MAPS_API_KEY requis pour CARTOGRAPHIE=google');
  return new GoogleMapsClient({ cle });
}
