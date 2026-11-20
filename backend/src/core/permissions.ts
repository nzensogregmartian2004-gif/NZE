// Permissions par module et par action (cahier V3.0 §4.2, point O-2 du registre).
// Chaque action sensible porte un identifiant « module.action » ; la matrice dit quels rôles peuvent l'exécuter.
// Une action absente de la matrice est refusée.
import type { NextFunction, Request, Response } from 'express';
import { getUser, type Role } from './auth.ts';
import { forbidden } from './errors.ts';

export const PERMISSIONS = {
  // Décision du fondateur (O-1) : seul l'administrateur principal approuve et verse les retraits.
  'retraits.approuver': ['admin_principal'],
  'retraits.consulter': ['admin_principal', 'admin_secondaire'],
  // Registres comptables (cahier V3.0 §15.1) : consultation seule.
  'ecritures.consulter': ['admin_principal', 'admin_secondaire'],
  // Conversations archivées (litiges et réclamations) : consultation seule (décision O-11).
  'conversations.archives.consulter': ['admin_principal', 'admin_secondaire'],
  // Matrice par défaut pour l'administrateur secondaire : tout sauf les retraits. À valider (O-2).
  'entreprises.gerer': ['admin_principal', 'admin_secondaire'],
  'commissions.gerer': ['admin_principal', 'admin_secondaire'],
  'stock.corriger': ['admin_principal', 'admin_secondaire'],
  // Fiches prestataires publicitaires et demandes reçues (D-P6) : administrées par NZE.
  'publicite.gerer': ['admin_principal', 'admin_secondaire'],
  // Récupération assistée du mot de passe : seul l'administrateur principal génère un code (choix de sécurité, à valider).
  'recuperation.assistee': ['admin_principal'],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function peut(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export function requirePermission(permission: Permission) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!peut(getUser(res).role, permission)) throw forbidden();
      next();
    } catch (err) {
      next(err);
    }
  };
}
