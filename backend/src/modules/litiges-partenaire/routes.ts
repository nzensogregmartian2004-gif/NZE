import { champsPage } from '../../core/pagination.ts';
// Routes des litiges entre NZE et un partenaire. Administration seulement : le partenaire et le client n'y ont pas accès.
import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../../db/client.ts';
import { ADMIN_ROLES, getUser, requireAuth, requireRole } from '../../core/auth.ts';
import { parse } from '../../core/http.ts';
import { PRIORITES } from '../../core/responsables.ts';
import { STATUTS_LITIGE, assignerLitige, cloreLitige, lireLitige, listerLitiges, ouvrirLitige } from './service.ts';

const uuid = z.string().uuid();

export function litigesPartenaireRouter(db: Db, sessionSecret: string) {
  const r = Router();
  const connecte = requireAuth(db, sessionSecret);
  const admin = [connecte, requireRole(...ADMIN_ROLES)];

  r.post('/admin/litiges-partenaire', ...admin, async (req, res) => {
    const b = parse(
      z.object({
        entrepriseId: uuid,
        reclamationId: uuid.optional(),
        motif: z.string().trim().min(5).max(200),
        description: z.string().trim().min(10).max(2000),
      }),
      req.body,
    );
    res.status(201).json(await ouvrirLitige(db, getUser(res), b));
  });

  r.get('/admin/litiges-partenaire', ...admin, async (req, res) => {
    const f = parse(
      z.object({
        statut: z.enum(STATUTS_LITIGE).optional(),
        entrepriseId: uuid.optional(),
        priorite: z.enum(PRIORITES).optional(),
        responsableId: uuid.optional(),
        ...champsPage(200),
      }),
      req.query,
    );
    res.json(await listerLitiges(db, f, f));
  });

  r.get('/admin/litiges-partenaire/:id', ...admin, async (req, res) => {
    res.json(await lireLitige(db, parse(uuid, req.params.id)));
  });

  r.patch('/admin/litiges-partenaire/:id', ...admin, async (req, res) => {
    const id = parse(uuid, req.params.id);
    const b = parse(
      z.object({
        responsableId: uuid.nullable().optional(),
        priorite: z.enum(PRIORITES).optional(),
      }),
      req.body,
    );
    res.json(await assignerLitige(db, getUser(res), id, b));
  });

  r.post('/admin/litiges-partenaire/:id/cloture', ...admin, async (req, res) => {
    const id = parse(uuid, req.params.id);
    const b = parse(z.object({ issue: z.string().trim().min(5).max(2000) }), req.body);
    res.json(await cloreLitige(db, getUser(res), id, b.issue));
  });

  return r;
}
