import { champsPage } from '../../core/pagination.ts';
// Routes des réclamations. Les règles d'accès sont dans le service.
import { Router } from 'express';
import { historiqueReclamation } from './historique.ts';
import { z } from 'zod';
import type { Db } from '../../db/client.ts';
import { ADMIN_ROLES, getUser, requireAuth, requireRole } from '../../core/auth.ts';
import { parse } from '../../core/http.ts';
import { PRIORITES } from '../../core/responsables.ts';
import {
  MOTIFS_RECLAMATION,
  SOLUTIONS,
  STATUTS_RECLAMATION,
  ajouterNote,
  assignerReclamation,
  cloturerReclamation,
  declarerReclamation,
  decider,
  lireReclamation,
  listerReclamations,
} from './service.ts';

const uuid = z.string().uuid();

export function reclamationsRouter(db: Db, sessionSecret: string) {
  const r = Router();
  const connecte = requireAuth(db, sessionSecret);
  const client = [connecte, requireRole('client')];
  const admin = [connecte, requireRole(...ADMIN_ROLES)];

  r.post('/reclamations', ...client, async (req, res) => {
    const b = parse(
      z.object({
        ligneCommandeId: uuid,
        motif: z.enum(MOTIFS_RECLAMATION),
        description: z.string().trim().min(10).max(2000),
      }),
      req.body,
    );
    res.status(201).json(await declarerReclamation(db, getUser(res), b));
  });

  r.get('/reclamations', connecte, async (req, res) => {
    const f = parse(
      z.object({
        statut: z.enum(STATUTS_RECLAMATION).optional(),
        enRetard: z.enum(['true', 'false']).optional(),
        priorite: z.enum(PRIORITES).optional(),
        responsableId: uuid.optional(),
        ...champsPage(200),
      }),
      req.query,
    );
    res.json(await listerReclamations(db, getUser(res), {
      statut: f.statut,
      enRetard: f.enRetard === undefined ? undefined : f.enRetard === 'true',
      priorite: f.priorite,
      responsableId: f.responsableId,
    }, f));
  });

  r.get('/reclamations/:id', connecte, async (req, res) => {
    res.json(await lireReclamation(db, getUser(res), parse(uuid, req.params.id)));
  });

  r.post('/admin/reclamations/:id/decision', ...admin, async (req, res) => {
    const id = parse(uuid, req.params.id);
    const b = parse(
      z.object({
        decision: z.enum(['ACCEPTER', 'REFUSER']),
        solution: z.enum(SOLUTIONS).optional(),
        motif: z.string().trim().max(500).optional(),
      }),
      req.body,
    );
    res.json(await decider(db, getUser(res), id, b));
  });

  r.post('/admin/reclamations/:id/cloture', ...admin, async (req, res) => {
    res.json(await cloturerReclamation(db, getUser(res), parse(uuid, req.params.id)));
  });

  // Responsable et priorité (cahier §17.2). null retire le responsable ; une clé absente ne change rien.
  r.patch('/admin/reclamations/:id', ...admin, async (req, res) => {
    const id = parse(uuid, req.params.id);
    const b = parse(
      z.object({
        responsableId: uuid.nullable().optional(),
        priorite: z.enum(PRIORITES).optional(),
      }),
      req.body,
    );
    res.json(await assignerReclamation(db, getUser(res), id, b));
  });

  // Note interne : visible de l'administration seulement.
  r.get('/admin/reclamations/:id/historique', ...admin, async (req, res) => {
    res.json(await historiqueReclamation(db, parse(uuid, req.params.id)));
  });

  r.post('/admin/reclamations/:id/notes', ...admin, async (req, res) => {
    const id = parse(uuid, req.params.id);
    const b = parse(z.object({ texte: z.string().trim().min(1).max(2000) }), req.body);
    res.status(201).json(await ajouterNote(db, getUser(res), id, b.texte));
  });

  return r;
}
