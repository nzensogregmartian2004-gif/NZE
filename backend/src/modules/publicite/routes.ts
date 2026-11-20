// Routes des prestataires publicitaires : fiches publiques, demande du client, administration NZE.
import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../../db/client.ts';
import { ADMIN_ROLES, getUser, requireAuth, requireRole } from '../../core/auth.ts';
import { requirePermission } from '../../core/permissions.ts';
import { parse } from '../../core/http.ts';
import type { Stockage } from '../stockage/r2.ts';
import {
  MOTIFS_DEMANDE,
  STATUTS_DEMANDE,
  STATUTS_FICHE,
  creerFiche,
  demanderPrestataire,
  detaillerFichePubliee,
  listerDemandes,
  listerFichesAdmin,
  listerFichesPubliees,
  definirPhotoFiche,
  modifierFiche,
  traiterDemande,
} from './service.ts';

const uuid = z.string().uuid();

export function publiciteRouter(db: Db, sessionSecret: string, stockage: Stockage | null) {
  const r = Router();
  const connecte = requireAuth(db, sessionSecret);
  const client = [connecte, requireRole('client')];
  const admin = [connecte, requireRole(...ADMIN_ROLES)];

  r.get('/prestataires', async (_req, res) => {
    res.json(await listerFichesPubliees(db, stockage));
  });

  r.get('/prestataires/:id', async (req, res) => {
    res.json(await detaillerFichePubliee(db, parse(uuid, req.params.id), stockage));
  });

  r.post('/prestataires/:id/demandes', ...client, async (req, res) => {
    const b = parse(
      z.object({ motif: z.enum(MOTIFS_DEMANDE), message: z.string().trim().min(10).max(2000) }),
      req.body,
    );
    res.status(201).json(await demanderPrestataire(db, getUser(res), parse(uuid, req.params.id), b));
  });

  r.get('/admin/prestataires', ...admin, requirePermission('publicite.gerer'), async (_req, res) => {
    res.json(await listerFichesAdmin(db));
  });

  r.post('/admin/prestataires', ...admin, requirePermission('publicite.gerer'), async (req, res) => {
    const b = parse(
      z.object({
        nomPublic: z.string().trim().min(2).max(120),
        activite: z.string().trim().min(2).max(80),
        description: z.string().max(2000).optional(),
        zone: z.string().max(80).optional(),
        ordre: z.number().int().min(0).max(999).optional(),
        statut: z.enum(STATUTS_FICHE).optional(),
      }),
      req.body,
    );
    res.status(201).json(await creerFiche(db, getUser(res).id, b));
  });

  r.patch('/admin/prestataires/:id', ...admin, requirePermission('publicite.gerer'), async (req, res) => {
    const b = parse(
      z.object({
        nomPublic: z.string().trim().min(2).max(120).optional(),
        activite: z.string().trim().min(2).max(80).optional(),
        description: z.string().max(2000).optional(),
        zone: z.string().max(80).nullable().optional(),
        ordre: z.number().int().min(0).max(999).optional(),
        statut: z.enum(STATUTS_FICHE).optional(),
      }),
      req.body,
    );
    res.json(await modifierFiche(db, getUser(res).id, parse(uuid, req.params.id), b));
  });

  r.post('/admin/prestataires/:id/photo', ...admin, requirePermission('publicite.gerer'), async (req, res) => {
    const b = parse(
      z.object({ contenu: z.string().min(1).max(4_200_000), typeMime: z.enum(['image/jpeg', 'image/png', 'image/webp']) }),
      req.body,
    );
    res.json(await definirPhotoFiche(db, stockage, getUser(res).id, parse(uuid, req.params.id), b.contenu, b.typeMime));
  });

  r.get('/admin/demandes-prestataire', ...admin, requirePermission('publicite.gerer'), async (req, res) => {
    const f = parse(z.object({ statut: z.enum(STATUTS_DEMANDE).optional() }), req.query);
    res.json(await listerDemandes(db, f.statut));
  });

  r.patch('/admin/demandes-prestataire/:id', ...admin, requirePermission('publicite.gerer'), async (req, res) => {
    const b = parse(
      z.object({ statut: z.enum(['TRAITEE', 'CLOTUREE']), note: z.string().max(500).optional() }),
      req.body,
    );
    res.json(await traiterDemande(db, getUser(res).id, parse(uuid, req.params.id), b));
  });

  return r;
}
