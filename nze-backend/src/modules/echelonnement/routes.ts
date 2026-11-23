import { detailEcheanciers } from './echeances.ts';
import { conditionsEcheancier, definirParametresArticle, definirPenaliteEchelonnement, lirePenaliteEchelonnement } from './service.ts';
import { champsPage } from '../../core/pagination.ts';
import { definirParametresEchelonnement, lireParametresEchelonnement } from './service.ts';
// Routes du paiement échelonné : client (proposer, payer, suivre), commerçant (voir ses encaissements), administration (contrôler).
import { Router } from 'express';
import { z } from 'zod';
import { ADMIN_ROLES, getUser, requireAuth, requireRole } from '../../core/auth.ts';
import { parse } from '../../core/http.ts';
import { verifierTransaction } from '../paiements/service.ts';
import { versementsEcheloneces, transactions } from '../../db/schema.ts';
import { and, eq } from 'drizzle-orm';
import {
  annulerPlan, creerPlan, definirEchelonnable, definirEchelonnement, detailPlanAdmin, echelonnementActif, listerPlansAdmin, mesPlans, monPlan, payerAvance, payerVersement,
  plansDuCommercant, relancerEcheances, syntheseAdmin, type EchelonnementDeps,
} from './service.ts';

const uuid = z.string().uuid();
const paiementChoix = z
  .object({
    canal: z.enum(['MOBILE_MONEY', 'CARTE']),
    operateur: z.enum(['AIRTEL_MONEY', 'MOOV_MONEY']).optional(),
    numero: z.string().regex(/^0?\d{7,9}$/, 'numéro mobile invalide').optional(),
  })
  .refine((c) => c.canal === 'CARTE' || (c.operateur && c.numero), { message: 'opérateur et numéro requis pour le mobile money' });

export function echelonnementRouter(deps: EchelonnementDeps, sessionSecret: string) {
  const r = Router();
  const connecte = requireAuth(deps.db, sessionSecret);
  const client = [connecte, requireRole('client')];
  const partenaire = [connecte, requireRole('partenaire')];
  const admin = [connecte, requireRole(...ADMIN_ROLES)];
  const principal = [connecte, requireRole('admin_principal')];

  // ----- Client -----
  r.get('/echelonnement/etat', ...client, async (_req, res) => {
    res.json({ actif: await echelonnementActif(deps.db) });
  });

  r.post('/commandes/:id/echelonnement', ...client, async (req, res) => {
    const id = parse(uuid, req.params.id);
    const b = parse(z.object({ mensualiteFcfa: z.number().int().positive().optional() }), req.body);
    res.status(201).json(await creerPlan(deps, getUser(res), id, b.mensualiteFcfa));
  });

  r.get('/echelonnements', ...client, async (_req, res) => {
    res.json(await mesPlans(deps.db, getUser(res)));
  });

  r.get('/echelonnements/:id', ...client, async (req, res) => {
    res.json(await monPlan(deps.db, getUser(res), parse(uuid, req.params.id)));
  });

  r.post('/echelonnements/:id/avance', ...client, async (req, res) => {
    const id = parse(uuid, req.params.id);
    const choix = parse(paiementChoix, req.body);
    res.status(201).json(await payerAvance(deps, getUser(res), id, choix));
  });

  r.post('/echelonnements/:id/versements', ...client, async (req, res) => {
    const id = parse(uuid, req.params.id);
    const b = parse(z.object({ montantFcfa: z.number().int().positive(), echeancierId: z.string().uuid().optional() }).and(paiementChoix), req.body);
    res.status(201).json(await payerVersement(deps, getUser(res), id, b.montantFcfa, { canal: b.canal, operateur: b.operateur, numero: b.numero }, b.echeancierId));
  });

  // Vérifie auprès de MyPVit les paiements en attente de ce plan (le client peut aussi y revenir après avoir payé).
  r.get('/echelonnements/:id/verifier-paiement', ...client, async (req, res) => {
    const id = parse(uuid, req.params.id);
    const p = await monPlan(deps.db, getUser(res), id);
    const liens = await deps.db
      .select({ id: transactions.id })
      .from(transactions)
      .innerJoin(versementsEcheloneces, eq(versementsEcheloneces.id, transactions.versementId!))
      .where(and(eq(versementsEcheloneces.planId, p.id), eq(transactions.statut, 'PENDING')));
    const resultats = [];
    for (const t of liens) resultats.push(await verifierTransaction(deps, t.id));
    res.json({ verifie: resultats.length, plan: await monPlan(deps.db, getUser(res), id) });
  });

  // ----- Commerçant -----
  r.get('/partenaire/echelonnements', ...partenaire, async (_req, res) => {
    const u = getUser(res);
    if (!u.entrepriseId) return res.json([]);
    res.json(await plansDuCommercant(deps.db, u.entrepriseId));
  });

  // ----- Administration : contrôle complet -----
  r.get('/admin/echelonnements', ...admin, async (req, res) => {
    const f = parse(z.object({ statut: z.enum(['PROPOSE', 'ACTIF', 'SOLDE', 'ANNULE']).optional(), enRetard: z.enum(['true', 'false']).optional(), ...champsPage(200) }), req.query);
    res.json(await listerPlansAdmin(deps.db, { statut: f.statut, enRetard: f.enRetard === undefined ? undefined : f.enRetard === 'true' }, f));
  });

  r.get('/admin/echelonnements/synthese', ...admin, async (_req, res) => {
    res.json(await syntheseAdmin(deps.db));
  });

  r.get('/admin/echelonnements/:id', ...admin, async (req, res) => {
    res.json(await detailPlanAdmin(deps.db, parse(uuid, req.params.id)));
  });

  r.post('/admin/echelonnements/:id/annulation', ...admin, async (req, res) => {
    const id = parse(uuid, req.params.id);
    const b = parse(z.object({ motif: z.string().trim().min(5).max(500) }), req.body);
    res.json(await annulerPlan(deps.db, getUser(res), id, b.motif));
  });

  r.post('/admin/echelonnements/relances', ...admin, async (_req, res) => {
    res.json(await relancerEcheances(deps.db));
  });

  r.get('/admin/reglages/echelonnement', ...admin, async (_req, res) => {
    res.json({ actif: await echelonnementActif(deps.db) });
  });

  r.put('/admin/reglages/echelonnement', ...principal, async (req, res) => {
    const b = parse(z.object({ actif: z.boolean() }), req.body);
    res.json(await definirEchelonnement(deps.db, getUser(res), b.actif));
  });

  r.get('/echelonnements/:id/echeanciers', ...client, async (req, res) => {
    res.json(await detailEcheanciers(deps.db, getUser(res), parse(uuid, req.params.id)));
  });

  r.get('/commandes/:id/echelonnement/conditions', ...client, async (req, res) => {
    res.json(await conditionsEcheancier(deps, getUser(res), String(req.params.id)));
  });

  r.get('/admin/reglages/echelonnement/penalite', ...admin, async (_req, res) => {
    res.json({ penaliteParMoisFcfa: await lirePenaliteEchelonnement(deps.db) });
  });

  r.put('/admin/reglages/echelonnement/penalite', ...principal, async (req, res) => {
    const b = parse(z.object({ penaliteParMoisFcfa: z.number() }), req.body);
    res.json(await definirPenaliteEchelonnement(deps.db, getUser(res), b.penaliteParMoisFcfa));
  });

  r.get('/admin/reglages/echelonnement/parametres', ...admin, async (_req, res) => {
    res.json(await lireParametresEchelonnement(deps.db));
  });

  r.put('/admin/reglages/echelonnement/parametres', ...principal, async (req, res) => {
    const b = parse(z.object({ avancePourcent: z.number(), dureeMaxMois: z.number() }), req.body);
    res.json(await definirParametresEchelonnement(deps.db, getUser(res), b));
  });

  r.patch('/admin/produits/:id/echelonnable', ...admin, async (req, res) => {
    const id = parse(uuid, req.params.id);
    const b = parse(z.object({ echelonnable: z.boolean().optional(), dureeMois: z.number().int().min(1).max(12).nullable().optional(), avancePourcent: z.number().int().min(10).max(90).nullable().optional() }), req.body);
    res.json(await definirParametresArticle(deps.db, getUser(res), id, b));
  });

  return r;
}
