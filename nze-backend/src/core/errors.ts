// Erreurs métier. Le message est destiné au client ; les détails techniques restent dans les journaux.
export class AppError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (message: string): AppError => new AppError(400, 'VALIDATION', message);
export const unauthorized = (message = 'Authentification requise'): AppError => new AppError(401, 'NON_AUTHENTIFIE', message);
export const forbidden = (message = 'Accès refusé'): AppError => new AppError(403, 'INTERDIT', message);
export const notFound = (message = 'Élément introuvable'): AppError => new AppError(404, 'INTROUVABLE', message);
export const conflict = (message: string): AppError => new AppError(409, 'CONFLIT', message);
export const tooManyRequests = (message: string): AppError => new AppError(429, 'TROP_DE_DEMANDES', message);
