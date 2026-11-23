// Adresse publique de l'API. Aucune clé secrète ici : tout EXPO_PUBLIC_ est visible dans l'application installée.
export const API_URL: string = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
