// Limite de débit à fenêtre fixe, par adresse IP. Compteurs en mémoire, propres à chaque application :
// à remplacer par un compteur partagé si l'API tourne sur plusieurs instances.
import type { NextFunction, Request, Response } from 'express';

export interface LimiteOptions {
  max: number;
  fenetreMs: number;
}

export function creerLimite({ max, fenetreMs }: LimiteOptions) {
  const compteurs = new Map<string, { nombre: number; debut: number }>();
  return (req: Request, res: Response, next: NextFunction): void => {
    const cle = req.ip ?? 'inconnu';
    const maintenant = Date.now();
    if (compteurs.size > 10_000) {
      for (const [k, v] of compteurs) if (maintenant - v.debut >= fenetreMs) compteurs.delete(k);
    }
    let c = compteurs.get(cle);
    if (!c || maintenant - c.debut >= fenetreMs) {
      c = { nombre: 0, debut: maintenant };
      compteurs.set(cle, c);
    }
    c.nombre += 1;
    if (c.nombre > max) {
      res.status(429).json({ erreur: { code: 'TROP_DE_REQUETES', message: 'Trop de requêtes. Réessayez dans une minute.' } });
      return;
    }
    next();
  };
}
