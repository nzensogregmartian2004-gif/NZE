// Enregistrement des appareils pour les notifications push. Chacun ne gère que ses propres appareils.
import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../../db/client.ts';
import { getUser, requireAuth } from '../../core/auth.ts';
import { parse } from '../../core/http.ts';
import { enregistrerAppareil, supprimerAppareil } from './service.ts';

const jeton = z.string().min(20).max(4096);

export function pushRouter(db: Db, sessionSecret: string) {
  const r = Router();
  const connecte = requireAuth(db, sessionSecret);

  r.post('/appareils', connecte, async (req, res) => {
    const b = parse(z.object({ jeton, plateforme: z.enum(['android', 'ios']) }), req.body);
    await enregistrerAppareil(db, getUser(res).id, b.jeton, b.plateforme);
    res.status(204).end();
  });

  r.delete('/appareils', connecte, async (req, res) => {
    const b = parse(z.object({ jeton }), req.body);
    await supprimerAppareil(db, getUser(res).id, b.jeton);
    res.status(204).end();
  });

  return r;
}
