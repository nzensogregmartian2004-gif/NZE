import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../../db/client.ts';
import { getUser, requireAuth, requireRole } from '../../core/auth.ts';
import { requirePermission } from '../../core/permissions.ts';
import { parse } from '../../core/http.ts';
import { eq } from 'drizzle-orm';
import { users } from '../../db/schema.ts';
import { LEGAL_VERSION } from '../legal/legal.content.ts';
import { creerLimite } from '../../core/limite.ts';
import {
  changerMotDePasse, connecter, demanderReinitialisation, genererCodeAssiste, inscrire, MOT_DE_PASSE_MIN, reinitialiserMotDePasse, type AuthDeps,
} from './service.ts';

const motDePasse = z.string().min(MOT_DE_PASSE_MIN).max(128);
const telephone = z.string().max(20);

export function authRouter(deps: AuthDeps & { db: Db }) {
  const r = Router();
  const auth = requireAuth(deps.db, deps.sessionSecret);
  // Connexion par mot de passe : 20 tentatives par adresse et par 10 minutes, pour freiner la devinette de mots de passe.
  const limiteConnexion = creerLimite({ max: 20, fenetreMs: 10 * 60 * 1000 });

  r.post('/auth/inscription', async (req, res) => {
    const b = parse(z.object({
      telephone,
      motDePasse,
      nomAffiche: z.string().min(2).max(80).optional(),
      langue: z.enum(['fr', 'en', 'ar', 'zh-Hans']).optional(),
      nom: z.string().max(60).optional(),
      prenom: z.string().max(60).optional(),
      dateNaissance: z.string().max(10).optional(),
      accepteConditions: z.boolean().optional(),
    }), req.body);
    const profilDemande = b.nom !== undefined || b.prenom !== undefined || b.dateNaissance !== undefined || b.accepteConditions !== undefined;
    const profil = profilDemande
      ? { nom: b.nom ?? '', prenom: b.prenom ?? '', dateNaissance: b.dateNaissance ?? '', accepteConditions: b.accepteConditions === true }
      : undefined;
    res.status(201).json(await inscrire(deps, b.telephone, b.motDePasse, b.nomAffiche, b.langue, profil));
  });

  r.post('/auth/connexion', limiteConnexion, async (req, res) => {
    const b = parse(z.object({ telephone, motDePasse: z.string().min(1).max(128) }), req.body);
    res.json(await connecter(deps, b.telephone, b.motDePasse));
  });

  r.post('/auth/mot-de-passe/oubli', async (req, res) => {
    const b = parse(z.object({ telephone }), req.body);
    res.json(await demanderReinitialisation(deps, b.telephone, req.ip));
  });

  r.post('/auth/mot-de-passe/reinitialiser', async (req, res) => {
    const b = parse(z.object({ telephone, code: z.string().regex(/^\d{6}$/), nouveauMotDePasse: motDePasse }), req.body);
    res.json(await reinitialiserMotDePasse(deps, b.telephone, b.code, b.nouveauMotDePasse));
  });

  // Récupération assistée (désactivée par défaut) : l'administrateur principal génère un code après avoir vérifié l'identité du client.
  r.post('/admin/recuperations-assistees', auth, requireRole('admin_principal'), requirePermission('recuperation.assistee'), async (req, res) => {
    const b = parse(z.object({ telephone }), req.body);
    res.status(201).json(await genererCodeAssiste(deps, b.telephone, getUser(res).id));
  });

  r.post('/auth/mot-de-passe/changer', auth, async (req, res) => {
    const b = parse(z.object({ ancien: z.string().min(1).max(128), nouveau: motDePasse }), req.body);
    res.json(await changerMotDePasse(deps, getUser(res), b.ancien, b.nouveau));
  });

  r.get('/auth/moi', auth, async (_req, res) => {
    const utilisateur = getUser(res);
    const [ligne] = await deps.db
      .select({ nomAffiche: users.nomAffiche, langue: users.langue, conditionsVersion: users.conditionsVersion })
      .from(users).where(eq(users.id, utilisateur.id)).limit(1);
    res.json({
      utilisateur: {
        ...utilisateur,
        nomAffiche: ligne?.nomAffiche ?? null,
        langue: ligne?.langue ?? 'fr',
        conditionsAcceptees: ligne?.conditionsVersion === LEGAL_VERSION,
      },
    });
  });

  return r;
}
