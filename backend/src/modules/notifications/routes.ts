// Notifications de l'utilisateur connecté. Chacun ne voit que les siennes.
import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../../db/client.ts';
import { getUser, requireAuth } from '../../core/auth.ts';
import { parse } from '../../core/http.ts';
import { compterNonLues, listerNotifications, marquerLue, marquerToutesLues } from './service.ts';

const uuid = z.string().uuid();

export function notificationsRouter(db: Db, sessionSecret: string) {
  const r = Router();
  const connecte = requireAuth(db, sessionSecret);

  r.get('/notifications', connecte, async (req, res) => {
    const f = parse(z.object({ limite: z.coerce.number().int().min(1).max(100).optional(), decalage: z.coerce.number().int().min(0).max(1000000).optional() }), req.query);
    res.json(await listerNotifications(db, getUser(res).id, f.limite ?? 50, f.decalage ?? 0));
  });

  r.get('/notifications/non-lues', connecte, async (_req, res) => {
    res.json(await compterNonLues(db, getUser(res).id));
  });

  r.post('/notifications/toutes-lues', connecte, async (_req, res) => {
    res.json(await marquerToutesLues(db, getUser(res).id));
  });

  r.post('/notifications/:id/lue', connecte, async (req, res) => {
    res.json(await marquerLue(db, getUser(res).id, parse(uuid, req.params.id)));
  });

  return r;
}
