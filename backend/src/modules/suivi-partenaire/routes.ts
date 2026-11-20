import { champsPage } from '../../core/pagination.ts';
import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../../db/client.ts';
import { getUser, requireAuth, requireRole } from '../../core/auth.ts';
import { forbidden } from '../../core/errors.ts';
import { parse } from '../../core/http.ts';
import { detailCollecte, historiqueStock, resumePartenaire } from './service.ts';

export function suiviPartenaireRouter(db: Db, sessionSecret: string) {
  const r = Router();
  const connecte = requireAuth(db, sessionSecret);
  const partenaire = [connecte, requireRole('partenaire')];

  r.get('/partenaire/resume', ...partenaire, async (_req, res) => {
    const u = getUser(res);
    if (!u.entrepriseId) throw forbidden();
    res.json(await resumePartenaire(db, u.entrepriseId));
  });

  r.get('/partenaire/mouvements-stock', ...partenaire, async (req, res) => {
    const u = getUser(res);
    if (!u.entrepriseId) throw forbidden();
    const f = parse(z.object(champsPage(100)), req.query);
    res.json(await historiqueStock(db, u.entrepriseId, f));
  });

  r.get('/partenaire/bordereaux/:id', ...partenaire, async (req, res) => {
    const id = parse(z.string().uuid(), req.params.id);
    res.json(await detailCollecte(db, getUser(res), id));
  });

  return r;
}
