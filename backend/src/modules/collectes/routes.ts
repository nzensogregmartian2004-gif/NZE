import { champsPage } from '../../core/pagination.ts';
// Routes des collectes et bordereaux. Les contrôles d'accès sont faits par le service (visibilité par rôle).
import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../../db/client.ts';
import { ADMIN_ROLES, getUser, requireAuth, requireRole } from '../../core/auth.ts';
import { parse } from '../../core/http.ts';
import { annulerBordereau, creerBordereau, deciderCollecte, lireBordereau, leverBlocage, listerArticlesARecuperer, listerBlocages, listerBordereaux, repondreCollectePartenaire } from './service.ts';

const uuid = z.string().uuid();
const motif = z.string().trim().min(5).max(500);

const ligneSchema = z.object({
  produitId: uuid,
  ligneCommandeId: uuid,
  quantite: z.number().int().min(1).max(10000),
  etat: z.string().trim().min(2).max(500),
  accessoires: z.string().max(500).optional(),
  testEffectue: z.boolean(),
  resultatTest: z.string().max(500).optional(),
  controle: z.enum(['CONFORME', 'ANOMALIE']),
  commentaire: z.string().max(1000).optional(),
});

const bordereauSchema = z.object({
  entrepriseId: uuid,
  etablissementId: uuid.optional(),
  commentaire: z.string().max(1000).optional(),
  lignes: z.array(ligneSchema).min(1).max(100),
});

export function collectesRouter(db: Db, sessionSecret: string) {
  const r = Router();
  const connecte = requireAuth(db, sessionSecret);
  const livreur = [connecte, requireRole('livreur')];
  const partenaire = [connecte, requireRole('partenaire')];
  const admin = [connecte, requireRole(...ADMIN_ROLES)];

  // Articles des commandes payées affectées au livreur et encore à récupérer chez un partenaire.
  r.get('/livreur/articles-a-recuperer', ...livreur, async (_req, res) => {
    res.json(await listerArticlesARecuperer(db, getUser(res)));
  });

  // Le livreur signale la récupération physique d'un article au magasin.
  r.post('/livreur/bordereaux', ...livreur, async (req, res) => {
    const b = parse(bordereauSchema, req.body);
    res.status(201).json(await creerBordereau(db, getUser(res), b));
  });

  r.get('/livreur/bordereaux', ...livreur, async (req, res) => {
    const f = parse(z.object(champsPage(200)), req.query);
    res.json(await listerBordereaux(db, getUser(res), {}, f));
  });

  r.get('/partenaire/bordereaux', ...partenaire, async (req, res) => {
    const f = parse(z.object(champsPage(200)), req.query);
    res.json(await listerBordereaux(db, getUser(res), {}, f));
  });

  r.post('/partenaire/bordereaux/:id/reponse', ...partenaire, async (req, res) => {
    const id = parse(uuid, req.params.id);
    const b = parse(z.discriminatedUnion('confirmer', [
      z.object({ confirmer: z.literal(true) }),
      z.object({ confirmer: z.literal(false), motif }),
    ]), req.body);
    res.json(await repondreCollectePartenaire(db, getUser(res), id, b));
  });

  r.get('/admin/bordereaux', ...admin, async (req, res) => {
    const f = parse(z.object({ statut: z.enum(['ATTENTE_PARTENAIRE', 'ATTENTE_VALIDATION_NZE', 'CONTESTE', 'VALIDE', 'REFUSE', 'ANNULE']).optional(), ...champsPage(200) }), req.query);
    res.json(await listerBordereaux(db, getUser(res), { statut: f.statut }, f));
  });

  r.post('/admin/bordereaux/:id/decision', connecte, requireRole('admin_principal'), async (req, res) => {
    const id = parse(uuid, req.params.id);
    const b = parse(z.discriminatedUnion('valider', [
      z.object({ valider: z.literal(true) }),
      z.object({ valider: z.literal(false), motif }),
    ]), req.body);
    res.json(await deciderCollecte(db, getUser(res), id, b));
  });

  r.get('/admin/blocages-livraison', ...admin, async (_req, res) => {
    res.json(await listerBlocages(db));
  });

  // Détail d'un bordereau : le service vérifie que l'utilisateur y a droit.
  r.get('/bordereaux/:id', connecte, async (req, res) => {
    res.json(await lireBordereau(db, getUser(res), parse(uuid, req.params.id)));
  });

  r.post('/admin/bordereaux/:id/annulation', ...admin, async (req, res) => {
    const id = parse(uuid, req.params.id);
    const b = parse(z.object({ motif }), req.body);
    res.json(await annulerBordereau(db, getUser(res).id, id, b.motif));
  });

  r.post('/admin/bordereaux/lignes/:id/levee-blocage', ...admin, async (req, res) => {
    const id = parse(uuid, req.params.id);
    const b = parse(z.object({ motif }), req.body);
    res.json(await leverBlocage(db, getUser(res).id, id, b.motif));
  });

  return r;
}
