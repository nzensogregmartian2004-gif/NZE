import { champsPage } from '../../core/pagination.ts';
// Routes des livraisons et des trois tableaux de bord. Les contrôles d'accès fins sont dans le service.
import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../../db/client.ts';
import { ADMIN_ROLES, getUser, requireAuth, requireRole } from '../../core/auth.ts';
import { parse } from '../../core/http.ts';
import {
  MOTIFS,
  MOTIFS_ECHEC,
  STATUTS,
  arriverLivraison,
  confirmerLivraison,
  creerLivraison,
  definirSuiviGps,
  enregistrerPosition,
  lireSuiviGps,
  demarrerLivraison,
  lireLivraison,
  listerLivraisons,
  livraisonsPourPartenaire,
  reassigner,
  signalerEchec,
  suiviClient,
  tableauAdministration,
  tableauLivreur,
  tableauPartenaire,
} from './service.ts';

const uuid = z.string().uuid();

export function livraisonsRouter(db: Db, sessionSecret: string) {
  const r = Router();
  const connecte = requireAuth(db, sessionSecret);
  const admin = [connecte, requireRole(...ADMIN_ROLES)];
  const livreur = [connecte, requireRole('livreur')];
  const partenaire = [connecte, requireRole('partenaire')];
  const client = [connecte, requireRole('client')];
  const principal = [connecte, requireRole('admin_principal')];

  // Administration : affectation, réaffectation, consultation, tableau de bord.
  r.post('/admin/livraisons', ...admin, async (req, res) => {
    const b = parse(z.object({ commandeId: uuid, livreurId: uuid, motif: z.enum(MOTIFS) }), req.body);
    res.status(201).json(await creerLivraison(db, getUser(res), b));
  });

  r.get('/admin/livraisons', ...admin, async (req, res) => {
    const f = parse(z.object({ statut: z.enum(STATUTS).optional(), livreurId: uuid.optional(), ...champsPage(200) }), req.query);
    res.json(await listerLivraisons(db, getUser(res), { statut: f.statut, livreurId: f.livreurId }, f));
  });

  r.get('/admin/livraisons/:id', ...admin, async (req, res) => {
    res.json(await lireLivraison(db, getUser(res), parse(uuid, req.params.id)));
  });

  r.post('/admin/livraisons/:id/reassigner', ...admin, async (req, res) => {
    const id = parse(uuid, req.params.id);
    const b = parse(z.object({ livreurId: uuid }), req.body);
    res.json(await reassigner(db, getUser(res), id, b.livreurId));
  });

  r.get('/admin/tableau-de-bord', ...admin, async (_req, res) => {
    res.json(await tableauAdministration(db));
  });

  // Livreur : ses missions, la saisie de chaque livraison, son tableau de bord.
  r.get('/livreur/livraisons', ...livreur, async (req, res) => {
    const f = parse(z.object(champsPage(200)), req.query);
    res.json(await listerLivraisons(db, getUser(res), {}, f));
  });

  r.get('/livreur/livraisons/:id', ...livreur, async (req, res) => {
    res.json(await lireLivraison(db, getUser(res), parse(uuid, req.params.id)));
  });

  r.post('/livreur/livraisons/:id/demarrer', ...livreur, async (req, res) => {
    res.json(await demarrerLivraison(db, getUser(res), parse(uuid, req.params.id)));
  });

  // Clôture : signature papier confirmée par le livreur (true obligatoire). Chaque article reçoit sa quantité livrée.
  r.post('/livreur/livraisons/:id/confirmer', ...livreur, async (req, res) => {
    const id = parse(uuid, req.params.id);
    const b = parse(
      z.object({
        signaturePapierRecue: z.literal(true, { errorMap: () => ({ message: 'la signature papier doit être confirmée' }) }),
        lignes: z.array(z.object({ ligneId: uuid, quantiteLivree: z.number().int().min(0).max(100000) })).min(1).max(100),
        commentaire: z.string().max(1000).optional(),
        latitude: z.number().min(-90).max(90).optional(),
        longitude: z.number().min(-180).max(180).optional(),
      }),
      req.body,
    );
    res.json(await confirmerLivraison(db, getUser(res), id, b));
  });

  r.post('/livreur/livraisons/:id/echec', ...livreur, async (req, res) => {
    const id = parse(uuid, req.params.id);
    const b = parse(
      z.object({
        motif: z.enum(MOTIFS_ECHEC),
        commentaire: z.string().max(1000).optional(),
        latitude: z.number().min(-90).max(90).optional(),
        longitude: z.number().min(-180).max(180).optional(),
      }),
      req.body,
    );
    res.json(await signalerEchec(db, getUser(res), id, b));
  });

  r.get('/livreur/tableau-de-bord', ...livreur, async (_req, res) => {
    res.json(await tableauLivreur(db, getUser(res).id));
  });

  // Partenaire : état des articles de son entreprise, sans données client ni livreur.
  r.get('/partenaire/livraisons', ...partenaire, async (req, res) => {
    const u = getUser(res);
    if (!u.entrepriseId) return res.json([]);
    const f = parse(z.object(champsPage(200)), req.query);
    res.json(await livraisonsPourPartenaire(db, u.entrepriseId, f));
  });

  r.get('/partenaire/tableau-de-bord', ...partenaire, async (_req, res) => {
    const u = getUser(res);
    if (!u.entrepriseId) return res.json({ livraisonsActives: 0, lignesParStatut: {}, articlesBloques: 0, bordereauxAnomalie: 0 });
    res.json(await tableauPartenaire(db, u.entrepriseId));
  });

  r.post('/livreur/livraisons/:id/arrivee', ...livreur, async (req, res) => {
    res.json(await arriverLivraison(db, getUser(res), parse(uuid, req.params.id)));
  });

  // Position GPS pendant la mission. Refusée si NZE n'a pas activé le suivi.
  r.post('/livreur/livraisons/:id/position', ...livreur, async (req, res) => {
    const id = parse(uuid, req.params.id);
    const b = parse(z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) }), req.body);
    res.json(await enregistrerPosition(db, getUser(res), id, b));
  });

  // Interrupteur du suivi GPS : désactivé par défaut.
  r.get('/admin/reglages/suivi-gps', ...admin, async (_req, res) => {
    res.json(await lireSuiviGps(db));
  });

  r.put('/admin/reglages/suivi-gps', ...principal, async (req, res) => {
    const b = parse(z.object({ actif: z.boolean() }), req.body);
    res.json(await definirSuiviGps(db, getUser(res), b.actif));
  });

  // Client : suivi de sa commande et code de remise, pendant la livraison seulement.
  r.get('/commandes/:id/livraison', ...client, async (req, res) => {
    res.json(await suiviClient(db, getUser(res).id, parse(uuid, req.params.id)));
  });

  return r;
}
