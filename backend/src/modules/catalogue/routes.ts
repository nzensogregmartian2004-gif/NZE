import { Router } from 'express';
import { requirePermission } from '../../core/permissions.ts';
import { z } from 'zod';
import type { Db } from '../../db/client.ts';
import { ADMIN_ROLES, getUser, requireAuth, requireRole } from '../../core/auth.ts';
import { parse } from '../../core/http.ts';
import { journaliser } from '../audit/service.ts';
import { changerStatutEntreprise } from '../entreprises/cycle.ts';
import { PAGE_MAX, creerCategorie, creerEntreprise, creerEtablissement, creerProduit, detaillerProduit, listerProduits, modifierProduit, listerEntreprises, modifierEntreprise } from './service.ts';

const uuid = z.string().uuid();

export function catalogueRouter(db: Db, sessionSecret: string) {
  const r = Router();
  const admin = [requireAuth(db, sessionSecret), requireRole(...ADMIN_ROLES)];

  r.get('/produits', async (req, res) => {
    const q = parse(z.object({
      q: z.string().max(80).optional(), categorie: z.string().max(60).optional(),
      enStock: z.enum(['true', 'false']).optional(),
      prixMin: z.coerce.number().int().min(0).max(100000000).optional(),
      prixMax: z.coerce.number().int().min(0).max(100000000).optional(),
      tri: z.enum(['nom', 'prix-croissant', 'prix-decroissant']).optional(),
      limite: z.coerce.number().int().min(1).max(PAGE_MAX).optional(),
      decalage: z.coerce.number().int().min(0).max(1000000).optional(),
    }), req.query);
    res.json(await listerProduits(db, {
      q: q.q, categorie: q.categorie, enStock: q.enStock === 'true', prixMin: q.prixMin, prixMax: q.prixMax, tri: q.tri,
      limite: q.limite, decalage: q.decalage,
    }));
  });

  r.get('/produits/:id', async (req, res) => {
    res.json(await detaillerProduit(db, parse(uuid, req.params.id)));
  });

  r.get('/admin/entreprises', ...admin, async (_req, res) => {
    res.json(await listerEntreprises(db));
  });

  r.post('/admin/entreprises', ...admin, async (req, res) => {
    const { nom } = parse(z.object({ nom: z.string().min(2).max(120) }), req.body);
    res.status(201).json(await creerEntreprise(db, nom));
  });

  r.patch('/admin/entreprises/:id', ...admin, requirePermission('entreprises.gerer'), async (req, res) => {
    const b = parse(z.object({
      nom: z.string().min(2).max(120).optional(), nomOfficiel: z.string().min(2).max(200).optional(),
      responsableNom: z.string().max(120).optional(), responsableRole: z.string().max(80).optional(),
      responsableTelephone: z.string().max(30).optional(), telephone: z.string().max(30).optional(), email: z.string().email().max(200).optional(),
    }), req.body);
    res.json(await modifierEntreprise(db, parse(uuid, req.params.id), getUser(res).id, b));
  });

  r.patch('/admin/entreprises/:id/statut', ...admin, requirePermission('entreprises.gerer'), async (req, res) => {
    const b = parse(z.object({ statut: z.enum(['prospect', 'negociation', 'actif', 'suspendu', 'cloture']), motif: z.string().max(500).optional() }), req.body);
    res.json(await changerStatutEntreprise(db, parse(uuid, req.params.id), b.statut, getUser(res).id, b.motif));
  });

  r.post('/admin/etablissements', ...admin, async (req, res) => {
    const b = parse(z.object({ entrepriseId: uuid, nom: z.string().min(2).max(120), adresse: z.string().max(300).optional() }), req.body);
    res.status(201).json(await creerEtablissement(db, b.entrepriseId, b.nom, b.adresse));
  });

  r.post('/admin/categories', ...admin, async (req, res) => {
    const b = parse(z.object({ nom: z.string().min(2).max(80), slug: z.string().regex(/^[a-z0-9-]{2,60}$/) }), req.body);
    res.status(201).json(await creerCategorie(db, b.nom, b.slug));
  });

  r.post('/admin/produits', ...admin, async (req, res) => {
    const b = parse(
      z.object({
        entrepriseId: uuid,
        etablissementId: uuid.optional(),
        categorieId: uuid.optional(),
        nom: z.string().min(2).max(160),
        description: z.string().max(4000).optional(),
        prixFcfa: z.number().int().positive(),
        garantieJours: z.number().int().min(0).max(3650).optional(),
        caracteristiques: z.array(z.object({ nom: z.string().min(1).max(60), valeur: z.string().min(1).max(200) })).max(30).optional(),
        photos: z.array(z.string().min(1).max(300)).max(10).optional(),
        statut: z.enum(['BROUILLON', 'PUBLIE', 'SUSPENDU']).optional(),
        commentaires: z.string().max(2000).optional(),
      }),
      req.body,
    );
    const produit = await creerProduit(db, b);
    await journaliser(db, { acteurId: getUser(res).id, action: 'PRODUIT_CREE', cibleType: 'produit', cibleId: produit.id, details: { entrepriseId: b.entrepriseId, prixFcfa: b.prixFcfa } });
    res.status(201).json(produit);
  });

  r.patch('/admin/produits/:id', ...admin, async (req, res) => {
    const id = parse(uuid, req.params.id);
    const b = parse(
      z.object({
        nom: z.string().min(2).max(160).optional(),
        description: z.string().max(4000).optional(),
        garantieJours: z.number().int().min(0).max(3650).optional(),
        prixFcfa: z.number().int().positive().optional(),
        statut: z.enum(['BROUILLON', 'PUBLIE', 'SUSPENDU']).optional(),
        caracteristiques: z.array(z.object({ nom: z.string().min(1).max(60), valeur: z.string().min(1).max(200) })).max(30).optional(),
        photos: z.array(z.string().min(1).max(300)).max(10).optional(),
        commentaires: z.string().max(2000).optional(),
      }),
      req.body,
    );
    const produit = await modifierProduit(db, id, b);
    const details: Record<string, string | number> = {};
    if (b.prixFcfa !== undefined) details.prixFcfa = b.prixFcfa;
    if (b.statut !== undefined) details.statut = b.statut;
    await journaliser(db, { acteurId: getUser(res).id, action: 'PRODUIT_MODIFIE', cibleType: 'produit', cibleId: id, details });
    res.json(produit);
  });

  return r;
}
