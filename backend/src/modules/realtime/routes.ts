// Route de délivrance des jetons Realtime, pour l'utilisateur connecté. Inactive tant que la clé n'est pas configurée.
import { Router } from 'express';
import type { Db } from '../../db/client.ts';
import { getUser, requireAuth } from '../../core/auth.ts';
import { AppError } from '../../core/errors.ts';
import { signerJetonRealtime, type ConfigRealtime } from './jeton.ts';

export function realtimeRouter(db: Db, sessionSecret: string, config: ConfigRealtime | null) {
  const r = Router();
  const auth = requireAuth(db, sessionSecret);

  r.get('/realtime/jeton', auth, (_req, res) => {
    if (!config) throw new AppError(503, 'REALTIME_NON_CONFIGURE', 'Le temps réel n’est pas configuré');
    res.json({ ...signerJetonRealtime(config, getUser(res).id), url: config.url });
  });

  return r;
}
