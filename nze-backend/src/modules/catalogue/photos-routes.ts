// Routes des photos d'articles : envoi par l'administration, affichage public, recherche par photo.
import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../../db/client.ts';
import { produits } from '../../db/schema.ts';
import { ADMIN_ROLES, getUser, requireAuth, requireRole } from '../../core/auth.ts';
import { parse } from '../../core/http.ts';
import { AppError, notFound } from '../../core/errors.ts';
import type { Stockage } from '../stockage/r2.ts';
import { enregistrerPhotoProduit, rechercherParPhoto } from './photos.ts';

const uuid = z.string().uuid();
const corpsImage = z.object({
  image: z.string().min(10),
  typeMime: z.string().min(9).max(30),
});

export function photosRouter(db: Db, sessionSecret: string, stockage: Stockage | null) {
  const r = Router();
  const admin = [requireAuth(db, sessionSecret), requireRole(...ADMIN_ROLES)];

  r.post('/admin/produits/:id/photo', ...admin, async (req, res) => {
    if (!stockage) throw new AppError(503, 'STOCKAGE_INDISPONIBLE', 'Le stockage des photos n’est pas configuré.');
    const id = parse(uuid, req.params.id);
    const b = parse(corpsImage, req.body);
    res.status(201).json(await enregistrerPhotoProduit(db, stockage, getUser(res), id, Buffer.from(b.image, 'base64'), b.typeMime));
  });

  r.get('/produits/:id/photo', async (req, res) => {
    const id = parse(uuid, req.params.id);
    const [p] = await db.select({ photoCle: produits.photoCle }).from(produits).where(eq(produits.id, id)).limit(1);
    if (!p || !p.photoCle || !stockage) throw notFound('Photo introuvable');
    res.redirect(302, await stockage.urlSignee(p.photoCle));
  });

  r.post('/recherche/photo', async (req, res) => {
    const b = parse(corpsImage, req.body);
    res.json(await rechercherParPhoto(db, stockage, Buffer.from(b.image, 'base64'), b.typeMime));
  });

  return r;
}
