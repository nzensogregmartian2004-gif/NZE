import { champsPage } from '../../core/pagination.ts';
import { and, desc, eq, sql } from 'drizzle-orm';
import { requirePermission } from '../../core/permissions.ts';
import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../../db/client.ts';
import { ADMIN_ROLES, getUser, requireAuth, requireRole } from '../../core/auth.ts';
import { forbidden } from '../../core/errors.ts';
import { journaliser } from '../audit/service.ts';
import { parse } from '../../core/http.ts';
import { commandes, ecritures, lignesCommande, produits } from '../../db/schema.ts';
import type { MyPvitClient } from '../paiements/providers/mypvit/index.ts';
import { decider, demanderRetrait, listerRetraitsAdmin, listerRetraitsEntreprise, soldeEntreprise, resoudreVersement, verifierVersement } from './retraits.ts';

const uuid = z.string().uuid();

export function financeRouter(db: Db, sessionSecret: string, mypvit: MyPvitClient) {
  const r = Router();
  const partenaire = [requireAuth(db, sessionSecret), requireRole('partenaire')];
  const admin = [requireAuth(db, sessionSecret), requireRole(...ADMIN_ROLES)];

  // Portefeuille : solde, montant en attente de retrait, disponible, et ventes détaillées.
  r.get('/partenaire/portefeuille', ...partenaire, async (req, res) => {
    const u = getUser(res);
    if (!u.entrepriseId) throw forbidden();
    const f = parse(z.object(champsPage(100)), req.query);
    const ventes = await db
      .select({ id: ecritures.id, montantFcfa: ecritures.montantFcfa, date: ecritures.createdAt, reference: commandes.reference, produit: produits.nom, quantite: lignesCommande.quantite })
      .from(ecritures)
      .innerJoin(commandes, eq(commandes.id, ecritures.commandeId))
      .leftJoin(lignesCommande, eq(lignesCommande.id, ecritures.ligneId))
      .leftJoin(produits, eq(produits.id, lignesCommande.produitId))
      .where(and(eq(ecritures.entrepriseId, u.entrepriseId), eq(ecritures.categorie, 'VENTE_NET')))
      .orderBy(desc(ecritures.createdAt), desc(ecritures.id))
      .limit(f.limite)
      .offset(f.decalage);
    res.json({ ...(await soldeEntreprise(db, u.entrepriseId)), ventes });
  });

  // Ventes du partenaire, page par page (le portefeuille n'en montre que la première page).
  r.get('/partenaire/ventes', ...partenaire, async (req, res) => {
    const u = getUser(res);
    if (!u.entrepriseId) throw forbidden();
    const f = parse(z.object(champsPage(50)), req.query);
    const ventes = await db
      .select({ id: ecritures.id, montantFcfa: ecritures.montantFcfa, date: ecritures.createdAt, reference: commandes.reference, produit: produits.nom, quantite: lignesCommande.quantite })
      .from(ecritures)
      .innerJoin(commandes, eq(commandes.id, ecritures.commandeId))
      .leftJoin(lignesCommande, eq(lignesCommande.id, ecritures.ligneId))
      .leftJoin(produits, eq(produits.id, lignesCommande.produitId))
      .where(and(eq(ecritures.entrepriseId, u.entrepriseId), eq(ecritures.categorie, 'VENTE_NET')))
      .orderBy(desc(ecritures.createdAt), desc(ecritures.id))
      .limit(f.limite)
      .offset(f.decalage);
    res.json(ventes);
  });

  r.post('/partenaire/retraits', ...partenaire, async (req, res) => {
    const b = parse(
      z.object({
        montantFcfa: z.number().int().positive(),
        operateur: z.enum(['AIRTEL_MONEY', 'MOOV_MONEY', 'CARTE']),
        numero: z.string().regex(/^\d{8,12}$/).optional(),
        nomBeneficiaire: z.string().min(2).max(80),
      }).superRefine((v, ctx) => {
        // Airtel et Moov : un numéro de téléphone. Carte : aucune donnée de carte n'est demandée ni stockée par NZE.
        if (v.operateur === 'CARTE' && v.numero !== undefined) ctx.addIssue({ code: 'custom', message: 'Aucun numéro n’est attendu pour un retrait par carte', path: ['numero'] });
        if (v.operateur !== 'CARTE' && v.numero === undefined) ctx.addIssue({ code: 'custom', message: 'Numéro de bénéficiaire requis', path: ['numero'] });
      }),
      req.body,
    );
    const demande = await demanderRetrait(db, getUser(res), b);
    await journaliser(db, { acteurId: getUser(res).id, action: 'RETRAIT_DEMANDE', cibleType: 'demande_retrait', cibleId: demande.id, details: { montantFcfa: b.montantFcfa, operateur: b.operateur } });
    res.status(201).json(demande);
  });

  r.get('/partenaire/retraits', ...partenaire, async (req, res) => {
    const u = getUser(res);
    if (!u.entrepriseId) throw forbidden();
    const f = parse(z.object(champsPage(200)), req.query);
    res.json(await listerRetraitsEntreprise(db, u.entrepriseId, f));
  });

  // Résumé pour NZE : commissions, frais de livraison et soldes dus par commerçant.
  r.get('/admin/finance/resume', ...admin, async (_req, res) => {
    const [{ commissions }] = await db
      .select({ commissions: sql<number>`coalesce(sum(${ecritures.montantFcfa}), 0)::int` })
      .from(ecritures)
      .where(eq(ecritures.categorie, 'COMMISSION'));
    const [{ fraisLivraison }] = await db
      .select({ fraisLivraison: sql<number>`coalesce(sum(${ecritures.montantFcfa}), 0)::int` })
      .from(ecritures)
      .where(eq(ecritures.categorie, 'FRAIS_LIVRAISON'));
    const soldes = await db
      .select({ entrepriseId: ecritures.entrepriseId, solde: sql<number>`sum(${ecritures.montantFcfa})::int` })
      .from(ecritures)
      .where(eq(ecritures.categorie, 'VENTE_NET'))
      .groupBy(ecritures.entrepriseId);
    res.json({ commissions, fraisLivraison, soldesCommercants: soldes });
  });

  // Trois registres : totaux par registre et dernières écritures (filtrables par registre).
  r.get('/admin/ecritures', ...admin, requirePermission('ecritures.consulter'), async (req, res) => {
    const registre = typeof req.query.registre === 'string' ? req.query.registre : undefined;
    const limite = Math.min(Math.max(Number(req.query.limite ?? 50) || 50, 1), 200);
    const totaux = await db
      .select({ registre: ecritures.registre, total: sql<number>`coalesce(sum(${ecritures.montantFcfa}), 0)::int` })
      .from(ecritures)
      .groupBy(ecritures.registre);
    const lignes = await db
      .select({
        id: ecritures.id, commandeId: ecritures.commandeId, entrepriseId: ecritures.entrepriseId,
        registre: ecritures.registre, categorie: ecritures.categorie, montantFcfa: ecritures.montantFcfa, creeLe: ecritures.createdAt,
      })
      .from(ecritures)
      .where(registre ? eq(ecritures.registre, registre) : undefined)
      .orderBy(desc(ecritures.createdAt), desc(ecritures.id))
      .limit(limite)
      .offset(Math.max(Number(req.query.decalage ?? 0) || 0, 0));
    res.json({ totaux: Object.fromEntries(totaux.map((t) => [t.registre, t.total])), lignes });
  });

  r.get('/admin/retraits', ...admin, requirePermission('retraits.consulter'), async (req, res) => {
    const f = parse(z.object({ statut: z.string().max(40).optional(), ...champsPage(200) }), req.query);
    res.json(await listerRetraitsAdmin(db, f.statut, f));
  });

  r.post('/admin/retraits/:id/decision', ...admin, requirePermission('retraits.approuver'), async (req, res) => {
    const id = parse(uuid, req.params.id);
    const b = parse(z.object({ decision: z.enum(['ACCEPTER', 'REJETER']) }), req.body);
    res.json(await decider({ db, mypvit }, id, b.decision, getUser(res).id));
  });

  r.post('/admin/retraits/:id/resoudre', ...admin, requirePermission('retraits.approuver'), async (req, res) => {
    const id = parse(uuid, req.params.id);
    const corps = (req.body ?? {}) as { issue?: unknown; motif?: unknown };
    const statut = await resoudreVersement({ db, mypvit }, id, corps.issue as 'VERSEE' | 'ECHEC', typeof corps.motif === 'string' ? corps.motif : '', getUser(res).id);
    res.json({ statut });
  });
  r.post('/admin/retraits/:id/verifier-versement', ...admin, requirePermission('retraits.approuver'), async (req, res) => {
    const id = parse(uuid, req.params.id);
    const statut = await verifierVersement({ db, mypvit }, id, getUser(res).id);
    res.json({ statut });
  });

  return r;
}
