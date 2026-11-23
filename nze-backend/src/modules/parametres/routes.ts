import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../../db/client.ts';
import { ADMIN_ROLES, getUser, requireAuth, requireRole } from '../../core/auth.ts';
import { parse } from '../../core/http.ts';
import { lireMessagePaiementSurPlace, modifierMessagePaiementSurPlace } from './service.ts';

// Message d'information avant « payer sur place ». Lecture publique, modification réservée à l'administration.
export function parametresRouter(db: Db, sessionSecret: string) {
  const r = Router();
  const connecte = requireAuth(db, sessionSecret);
  const admin = [connecte, requireRole(...ADMIN_ROLES)];

  r.get('/reglages/paiement-sur-place', async (_req, res) => {
    res.json({ message: await lireMessagePaiementSurPlace(db) });
  });

  r.get('/admin/reglages/paiement-sur-place', ...admin, async (_req, res) => {
    res.json({ message: await lireMessagePaiementSurPlace(db) });
  });

  r.put('/admin/reglages/paiement-sur-place', ...admin, async (req, res) => {
    const b = parse(z.object({ message: z.string().min(20).max(600) }), req.body);
    res.json(await modifierMessagePaiementSurPlace(db, getUser(res).id, b.message));
  });

  return r;
}
