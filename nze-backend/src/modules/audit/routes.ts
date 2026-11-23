// Consultation du journal d'audit : réservée à l'administrateur principal.
import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../../db/client.ts';
import { requireAuth, requireRole } from '../../core/auth.ts';
import { parse } from '../../core/http.ts';
import { listerJournal } from './service.ts';

export function auditRouter(db: Db, sessionSecret: string) {
  const r = Router();
  const principal = [requireAuth(db, sessionSecret), requireRole('admin_principal')];

  r.get('/admin/journal', ...principal, async (req, res) => {
    const f = parse(
      z.object({
        action: z.string().max(60).optional(),
        cibleId: z.string().max(60).optional(),
        limite: z.coerce.number().int().min(1).max(200).optional(),
        decalage: z.coerce.number().int().min(0).max(1000000).optional(),
      }),
      req.query,
    );
    res.json(await listerJournal(db, { ...f, limite: f.limite ?? 50 }));
  });

  return r;
}
