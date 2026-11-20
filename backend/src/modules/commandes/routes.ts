import { champsPage } from '../../core/pagination.ts';
import { lireMessagePaiementSurPlace } from '../parametres/service.ts';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../../db/client.ts';
import { ADMIN_ROLES, getUser, requireAuth, requireRole } from '../../core/auth.ts';
import { notFound } from '../../core/errors.ts';
import { parse } from '../../core/http.ts';
import { commandes, transactions } from '../../db/schema.ts';
import { initierPaiement, verifierTransaction, type PaiementDeps } from '../paiements/service.ts';
import { annulerCommande, choisirPaiementSurPlace, creerCommande, definirEtapePreparation, listerCommandes, lireCommande } from './service.ts';

const uuid = z.string().uuid();

const choixPaiement = z.discriminatedUnion('canal', [
  z.object({ canal: z.literal('MOBILE_MONEY'), operateur: z.enum(['AIRTEL_MONEY', 'MOOV_MONEY']), numero: z.string().regex(/^\d{8,12}$/) }),
  z.object({ canal: z.literal('CARTE') }),
]);

export function commandesRouter(deps: PaiementDeps & { db: Db; sessionSecret: string }) {
  const r = Router();
  const client = [requireAuth(deps.db, deps.sessionSecret), requireRole('client')];
  const connecte = requireAuth(deps.db, deps.sessionSecret);
  const administration = [requireAuth(deps.db, deps.sessionSecret), requireRole(...ADMIN_ROLES)];

  r.post('/admin/commandes/:id/etape', ...administration, async (req, res) => {
    const b = parse(z.object({ etape: z.enum(['EN_PREPARATION', 'PRETE']) }), req.body);
    res.json(await definirEtapePreparation(deps.db, getUser(res), String(req.params.id), b.etape));
  });

  r.post('/commandes', ...client, async (req, res) => {
    const b = parse(
      z.object({
        lignes: z.array(z.object({ produitId: uuid, quantite: z.number().int() })).min(1).max(50),
        reception: z.enum(['LIVRAISON', 'RETRAIT']),
        livraison: z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) }).optional(),
      }),
      req.body,
    );
    res.status(201).json(await creerCommande(deps.db, getUser(res), b, deps.cartographie));
  });

  r.get('/commandes', ...client, async (req, res) => {
    const f = parse(z.object(champsPage(50)), req.query);
    res.json(await listerCommandes(deps.db, getUser(res), f));
  });

  r.get('/commandes/:id', connecte, async (req, res) => {
    res.json(await lireCommande(deps.db, getUser(res), parse(uuid, req.params.id)));
  });

  r.post('/commandes/:id/paiement', ...client, async (req, res) => {
    const choix = parse(choixPaiement, req.body);
    res.status(201).json(await initierPaiement(deps, getUser(res), parse(uuid, req.params.id), choix));
  });

  r.post('/commandes/:id/verifier-paiement', ...client, async (req, res) => {
    const id = parse(uuid, req.params.id);
    const user = getUser(res);
    const [c] = await deps.db.select({ id: commandes.id }).from(commandes).where(and(eq(commandes.id, id), eq(commandes.userId, user.id))).limit(1);
    if (!c) throw notFound('Commande introuvable');
    const [t] = await deps.db
      .select({ id: transactions.id })
      .from(transactions)
      .where(and(eq(transactions.commandeId, id), inArray(transactions.statut, ['PENDING', 'UNCERTAIN'])))
      .orderBy(desc(transactions.createdAt))
      .limit(1);
    if (!t) {
      res.json({ statut: 'AUCUN_PAIEMENT_EN_COURS' });
      return;
    }
    res.json({ statut: await verifierTransaction(deps, t.id) });
  });

  r.post('/commandes/:id/paiement-sur-place', ...client, async (req, res) => {
    const resultat = await choisirPaiementSurPlace(deps.db, getUser(res), parse(uuid, req.params.id));
    res.json({ ...resultat, message: await lireMessagePaiementSurPlace(deps.db) });
  });

  r.post('/commandes/:id/annulation', ...client, async (req, res) => {
    res.json(await annulerCommande(deps.db, getUser(res), parse(uuid, req.params.id)));
  });

  return r;
}
