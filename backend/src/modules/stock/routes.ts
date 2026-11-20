import { Router } from 'express';
import { requirePermission } from '../../core/permissions.ts';
import { z } from 'zod';
import type { Db } from '../../db/client.ts';
import { ADMIN_ROLES, getUser, requireAuth, requireRole } from '../../core/auth.ts';
import { forbidden } from '../../core/errors.ts';
import { parse } from '../../core/http.ts';
import { ajusterStock, changerEtatStock, ETATS_STOCK, produitsDuPartenaire, signalerStock } from './service.ts';

const uuid = z.string().uuid();

export function stockRouter(db: Db, sessionSecret: string) {
  const r = Router();
  const partenaire = [requireAuth(db, sessionSecret), requireRole('partenaire')];
  const admin = [requireAuth(db, sessionSecret), requireRole(...ADMIN_ROLES)];

  r.get('/partenaire/produits', ...partenaire, async (_req, res) => {
    const u = getUser(res);
    if (!u.entrepriseId) throw forbidden();
    res.json(await produitsDuPartenaire(db, u.entrepriseId));
  });

  r.post('/partenaire/signalements', ...partenaire, async (req, res) => {
    const b = parse(
      z.object({
        produitId: uuid,
        genre: z.enum(['VENTE', 'RUPTURE', 'RETOUR', 'VARIATION']),
        quantite: z.number().int().min(-10000).max(10000),
      }),
      req.body,
    );
    res.status(201).json(await signalerStock(db, getUser(res), b.produitId, b.genre, b.quantite));
  });

  r.patch('/admin/produits/:id/etat-stock', ...admin, requirePermission('stock.corriger'), async (req, res) => {
    const id = parse(uuid, req.params.id);
    const b = parse(z.object({ etat: z.enum(ETATS_STOCK), motif: z.string().max(300).optional() }), req.body);
    res.json(await changerEtatStock(db, id, b.etat, getUser(res).id, b.motif));
  });

  r.post('/admin/produits/:id/ajustements', ...admin, requirePermission('stock.corriger'), async (req, res) => {
    const id = parse(uuid, req.params.id);
    const b = parse(z.object({ delta: z.number().int().min(-100000).max(100000), motif: z.string().min(3).max(200) }), req.body);
    res.json(await ajusterStock(db, id, b.delta, b.motif, getUser(res).id));
  });

  return r;
}
