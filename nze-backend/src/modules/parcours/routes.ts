import { champsPage } from '../../core/pagination.ts';
import type { Cartographie } from '../cartographie/index.ts';
import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../../db/client.ts';
import { ADMIN_ROLES, getUser, requireAuth, requireRole } from '../../core/auth.ts';
import { parse } from '../../core/http.ts';
import {
  achatsANouveau, ajouterAdresse, ajouterListeEnvies, LANGUES, lireProfil, lirePanier, listerAdresses, listerCategories, listerCommandesAdmin,
  listerListeEnvies, listerProduitsAdmin, modifierProfil, remplacerPanier, retirerListeEnvies, supprimerAdresse,
} from './service.ts';

const uuid = z.string().uuid();
const lignesSchema = z.array(z.object({ produitId: uuid, quantite: z.number().int() })).max(50);

export function parcoursRouter(db: Db, sessionSecret: string, cartographie: Cartographie) {
  const r = Router();
  const connecte = requireAuth(db, sessionSecret);
  const client = [connecte, requireRole('client')];
  const admin = [connecte, requireRole(...ADMIN_ROLES)];

  r.get('/categories', async (_req, res) => {
    res.json(await listerCategories(db));
  });

  r.get('/profil', connecte, async (_req, res) => {
    res.json(await lireProfil(db, getUser(res)));
  });

  r.patch('/profil', connecte, async (req, res) => {
    const b = parse(z.object({
      nomAffiche: z.string().min(2).max(80).optional(),
      langue: z.enum(LANGUES).optional(),
      nom: z.string().trim().min(1).max(60).optional(),
      prenom: z.string().trim().min(1).max(60).optional(),
    }), req.body);
    res.json(await modifierProfil(db, getUser(res), b));
  });

  r.get('/adresses', ...client, async (_req, res) => {
    res.json(await listerAdresses(db, getUser(res)));
  });

  r.post('/adresses', ...client, async (req, res) => {
    const b = parse(
      z.object({
        libelle: z.string().min(1).max(60),
        quartier: z.string().min(2).max(120),
        repere: z.string().max(200).optional(),
        batiment: z.string().max(80).optional(),
        etage: z.string().max(20).optional(),
        instructions: z.string().max(300).optional(),
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        photoCle: z.string().min(1).max(300).optional(),
      }),
      req.body,
    );
    res.status(201).json(await ajouterAdresse(db, getUser(res), b));
  });

  r.delete('/adresses/:id', ...client, async (req, res) => {
    res.json(await supprimerAdresse(db, getUser(res), parse(uuid, req.params.id)));
  });

  r.get('/listes-envies', ...client, async (_req, res) => {
    res.json(await listerListeEnvies(db, getUser(res)));
  });

  r.post('/listes-envies', ...client, async (req, res) => {
    const b = parse(z.object({ produitId: uuid }), req.body);
    res.status(201).json(await ajouterListeEnvies(db, getUser(res), b.produitId));
  });

  r.delete('/listes-envies/:produitId', ...client, async (req, res) => {
    res.json(await retirerListeEnvies(db, getUser(res), parse(uuid, req.params.produitId)));
  });

  r.get('/achats-a-nouveau', ...client, async (_req, res) => {
    res.json(await achatsANouveau(db, getUser(res)));
  });

  r.get('/panier', ...client, async (_req, res) => {
    res.json(await lirePanier(db, getUser(res)));
  });

  r.put('/panier', ...client, async (req, res) => {
    const b = parse(
      z.object({
        lignes: lignesSchema,
        reception: z.enum(['LIVRAISON', 'RETRAIT']).optional(),
        livraison: z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) }).optional(),
      }),
      req.body,
    );
    if (b.lignes.length === 0) {
      res.json(await remplacerPanier(db, getUser(res), { lignes: [] }, cartographie));
      return;
    }
    res.json(await remplacerPanier(db, getUser(res), { lignes: b.lignes, reception: b.reception ?? 'RETRAIT', livraison: b.livraison }, cartographie));
  });

  r.get('/admin/commandes', ...admin, async (req, res) => {
    const f = parse(z.object({ statut: z.string().max(40).optional(), ...champsPage(200) }), req.query);
    res.json(await listerCommandesAdmin(db, f.statut, f));
  });

  r.get('/admin/produits', ...admin, async (req, res) => {
    const f = parse(z.object(champsPage(200)), req.query);
    res.json(await listerProduitsAdmin(db, f));
  });

  return r;
}
