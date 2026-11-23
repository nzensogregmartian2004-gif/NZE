// Client HTTP vers l'API NZE. Ajoute le jeton, lit les erreurs au format de l'API.
import { API_URL } from '../config';
import { lireJeton } from './jeton';

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export async function appeler<T>(chemin: string, options: { methode?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; corps?: unknown; sansJeton?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.corps !== undefined) headers['Content-Type'] = 'application/json';
  if (!options.sansJeton) {
    const jeton = await lireJeton();
    if (jeton) headers.Authorization = `Bearer ${jeton}`;
  }
  let reponse: Response;
  try {
    reponse = await fetch(`${API_URL}${chemin}`, {
      method: options.methode ?? 'GET',
      headers,
      body: options.corps !== undefined ? JSON.stringify(options.corps) : undefined,
    });
  } catch {
    throw new ApiError(0, 'RESEAU', 'Connexion impossible. Vérifiez votre réseau.');
  }
  const texte = await reponse.text();
  const donnees = texte ? JSON.parse(texte) : null;
  if (!reponse.ok) {
    const erreur = donnees?.erreur;
    throw new ApiError(reponse.status, erreur?.code ?? 'ERREUR', erreur?.message ?? 'Une erreur est survenue');
  }
  return donnees as T;
}
