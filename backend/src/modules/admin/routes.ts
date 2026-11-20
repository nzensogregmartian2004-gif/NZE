import { hashMotDePasse } from '../../core/security.ts';
import { requirePermission } from '../../core/permissions.ts';
// Administration : commissions, point fixe, tarif de livraison, comptes partenaires et rôles.
import { eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../../db/client.ts';
import { ADMIN_ROLES, getUser, requireAuth, requireRole } from '../../core/auth.ts';
import { conflict, notFound } from '../../core/errors.ts';
import { parse } from '../../core/http.ts';
import { entreprises, users } from '../../db/schema.ts';
import { definirCommission } from '../finance/commissions.ts';
import { definirPointFixe, definirTarif } from '../parametres/service.ts';
import { creerAdministrateur, normaliserTelephone } from '../auth/service.ts';
import { journaliser } from '../audit/service.ts';

const uuid = z.string().uuid();

export function adminRouter(db: Db, sessionSecret: string) {
  const r = Router();
  const admin = [requireAuth(db, sessionSecret), requireRole(...ADMIN_ROLES)];
  const principal = [requireAuth(db, sessionSecret), requireRole('admin_principal')];

  r.post('/admin/commissions', ...admin, requirePermission('commissions.gerer'), async (req, res) => {
    const b = parse(z.object({
      entrepriseId: uuid, tauxBps: z.number().int().min(0).max(10000),
      effetDebut: z.string().datetime().optional(), dureeMois: z.number().int().min(1).max(120).optional(),
      conditions: z.string().max(2000).optional(), documentUrl: z.string().url().max(500).optional(),
    }), req.body);
    const commission = await definirCommission(db, b.entrepriseId, b.tauxBps, getUser(res).id,
      b.effetDebut ? new Date(b.effetDebut) : new Date(),
      { dureeMois: b.dureeMois ?? null, conditions: b.conditions ?? null, documentUrl: b.documentUrl ?? null });
    res.status(201).json(commission);
  });

  r.post('/admin/livraison/point-fixe', ...admin, async (req, res) => {
    const b = parse(z.object({ libelle: z.string().min(2).max(120), latitude: z.number(), longitude: z.number() }), req.body);
    const point = await definirPointFixe(db, b.libelle, b.latitude, b.longitude, getUser(res).id);
    res.status(201).json(point);
  });

  r.post('/admin/livraison/tarif', ...admin, async (req, res) => {
    const b = parse(z.object({ fcfaParKm: z.number().int().min(0), minimumFcfa: z.number().int().min(0) }), req.body);
    const tarif = await definirTarif(db, b.fcfaParKm, b.minimumFcfa, getUser(res).id);
    res.status(201).json(tarif);
  });

  r.post('/admin/partenaires', ...admin, async (req, res) => {
    const b = parse(z.object({ telephone: z.string().max(20), entrepriseId: uuid, motDePasse: z.string().min(8).max(128) }), req.body);
    const hash = await hashMotDePasse(b.motDePasse);
    const telephone = normaliserTelephone(b.telephone);
    const [existant] = await db.select().from(users).where(eq(users.telephone, telephone)).limit(1);
    if (existant && existant.role !== 'client') throw conflict('Ce numéro a déjà un rôle');
    if (existant) {
      // Un mot de passe déjà défini n'est jamais remplacé par l'administration.
      const [u] = await db.update(users).set({ role: 'partenaire', entrepriseId: b.entrepriseId, motDePasseHash: existant.motDePasseHash ?? hash }).where(eq(users.id, existant.id)).returning();
      await journaliser(db, { acteurId: getUser(res).id, action: 'COMPTE_PARTENAIRE_LIE', cibleType: 'utilisateur', cibleId: u.id, details: { entrepriseId: b.entrepriseId } });
      res.status(200).json({ id: u.id, role: u.role });
      return;
    }
    const [u] = await db.insert(users).values({ telephone, role: 'partenaire', entrepriseId: b.entrepriseId, motDePasseHash: hash }).returning();
    await journaliser(db, { acteurId: getUser(res).id, action: 'COMPTE_PARTENAIRE_CREE', cibleType: 'utilisateur', cibleId: u.id, details: { entrepriseId: b.entrepriseId } });
    res.status(201).json({ id: u.id, role: u.role });
  });

  r.post('/admin/utilisateurs/:id/role', ...principal, async (req, res) => {
    const id = parse(uuid, req.params.id);
    const b = parse(z.object({ role: z.enum(['client', 'admin_secondaire', 'partenaire', 'livreur']) }), req.body);
    if (getUser(res).id === id) throw conflict('Un administrateur ne peut pas modifier son propre rôle');
    const [avant] = await db.select({ role: users.role }).from(users).where(eq(users.id, id)).limit(1);
    if (!avant) throw notFound('Utilisateur introuvable');
    const [u] = await db.update(users).set({ role: b.role }).where(eq(users.id, id)).returning({ id: users.id, role: users.role });
    await journaliser(db, { acteurId: getUser(res).id, action: 'ROLE_MODIFIE', cibleType: 'utilisateur', cibleId: id, details: { ancienRole: avant.role, nouveauRole: b.role } });
    res.json(u);
  });

  r.post('/admin/administrateurs', ...principal, async (req, res) => {
    const b = parse(z.object({ telephone: z.string().max(20), role: z.enum(['admin_principal', 'admin_secondaire']) }), req.body);
    const administrateur = await creerAdministrateur(db, b.telephone, b.role);
    await journaliser(db, { acteurId: getUser(res).id, action: 'ADMIN_ATTRIBUE', cibleType: 'utilisateur', cibleId: administrateur.id, details: { role: b.role } });
    res.status(201).json(administrateur);
  });

  r.patch('/admin/entreprises/:id/emplacement', ...admin, async (req, res) => {
    const id = parse(uuid, req.params.id);
    const b = parse(z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) }), req.body);
    const [e] = await db.update(entreprises).set({ latitude: b.latitude, longitude: b.longitude }).where(eq(entreprises.id, id)).returning({ id: entreprises.id, latitude: entreprises.latitude, longitude: entreprises.longitude });
    if (!e) throw notFound('Entreprise introuvable');
    await journaliser(db, { acteurId: getUser(res).id, action: 'EMPLACEMENT_MODIFIE', cibleType: 'entreprise', cibleId: id, details: { latitude: b.latitude, longitude: b.longitude } });
    res.json(e);
  });

  return r;
}
