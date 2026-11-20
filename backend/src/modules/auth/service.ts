import { AppError } from '../../core/errors.ts';
import { tentativesConnexion } from '../../db/schema.ts';
// Authentification : inscription et connexion par téléphone et mot de passe, sans code SMS.
// Le code OTP (eSMS) ne sert qu'à renouveler un mot de passe oublié. Un code est valable 5 minutes, 5 tentatives maximum.
import { and, count, desc, eq, gt } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import { otpCodes, sessions, users } from '../../db/schema.ts';
import { badRequest, conflict, forbidden, notFound, tooManyRequests, unauthorized } from '../../core/errors.ts';
import { journaliser } from '../audit/service.ts';
import { hashMotDePasse, hashOtp, hashToken, newOtp, newToken, verifierMotDePasse } from '../../core/security.ts';
import type { AuthUser } from '../../core/auth.ts';
import type { OtpSender } from './otp-sender.ts';

export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_TENTATIVES = 5;
// Limite de demandes de code par numéro : protège contre l'envoi massif de SMS (coût et abus).
export const OTP_MAX_DEMANDES = 5;
export const OTP_FENETRE_MS = 10 * 60 * 1000;
// Limite par adresse IP : empêche de contourner la limite par numéro en changeant de numéro.
export const OTP_MAX_DEMANDES_PAR_IP = 30;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const MOT_DE_PASSE_MIN = 8;

export interface AuthDeps {
  db: Db;
  sessionSecret: string;
  sender: OtpSender;
  // Mode assisté : aucun SMS, le code est généré par NZE après vérification de l'identité du client.
  recuperationAssistee?: boolean;
}

export function normaliserTelephone(brut: string): string {
  const propre = brut.replace(/[\s.-]/g, '');
  if (!/^\+\d{8,15}$/.test(propre)) {
    throw badRequest('Numéro invalide : format international attendu (ex. +241...)');
  }
  return propre;
}

export function validerMotDePasse(motDePasse: string): string {
  if (motDePasse.length < MOT_DE_PASSE_MIN || motDePasse.length > 128) {
    throw badRequest(`Mot de passe : entre ${MOT_DE_PASSE_MIN} et 128 caractères`);
  }
  return motDePasse;
}

async function ouvrirSession(deps: AuthDeps, utilisateur: { id: string; role: string; telephone: string }) {
  const token = newToken();
  await deps.db.insert(sessions).values({
    tokenHash: hashToken(token, deps.sessionSecret),
    userId: utilisateur.id,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  return { token, utilisateur: { id: utilisateur.id, role: utilisateur.role, telephone: utilisateur.telephone } };
}

export async function inscrire(deps: AuthDeps, brut: string, motDePasse: string, nomAffiche?: string, langue: 'fr' | 'en' | 'ar' | 'zh-Hans' = 'fr') {
  const telephone = normaliserTelephone(brut);
  validerMotDePasse(motDePasse);
  const [existant] = await deps.db.select({ id: users.id }).from(users).where(eq(users.telephone, telephone)).limit(1);
  if (existant) throw conflict('Un compte existe déjà pour ce numéro. Connectez-vous ou renouvelez votre mot de passe.');
  const [u] = await deps.db
    .insert(users)
    .values({ telephone, role: 'client', motDePasseHash: await hashMotDePasse(motDePasse), nomAffiche: nomAffiche ?? null, langue })
    .returning();
  return ouvrirSession(deps, u);
}

// Verrouillage par numéro : 5 échecs consécutifs bloquent la connexion pendant 15 minutes.
export const CONNEXION_MAX_ECHECS = 5;
export const CONNEXION_VERROUILLAGE_MS = 15 * 60 * 1000;

async function verifierNonVerrouille(db: Db, telephone: string): Promise<void> {
  const [t] = await db.select().from(tentativesConnexion).where(eq(tentativesConnexion.telephone, telephone)).limit(1);
  if (t?.verrouilleJusqua && t.verrouilleJusqua.getTime() > Date.now()) {
    throw new AppError(429, 'COMPTE_VERROUILLE', 'Trop de tentatives de connexion. Réessayez dans quelques minutes.');
  }
}

async function enregistrerEchec(db: Db, telephone: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [t] = await tx.select().from(tentativesConnexion).where(eq(tentativesConnexion.telephone, telephone)).for('update').limit(1);
    const echecs = (t?.echecs ?? 0) + 1;
    const verrouilleJusqua = echecs >= CONNEXION_MAX_ECHECS ? new Date(Date.now() + CONNEXION_VERROUILLAGE_MS) : null;
    await tx
      .insert(tentativesConnexion)
      .values({ telephone, echecs: verrouilleJusqua ? 0 : echecs, verrouilleJusqua, misAJourLe: new Date() })
      .onConflictDoUpdate({
        target: tentativesConnexion.telephone,
        set: { echecs: verrouilleJusqua ? 0 : echecs, verrouilleJusqua, misAJourLe: new Date() },
      });
  });
}

async function reinitialiserEchecs(db: Db, telephone: string): Promise<void> {
  await db.delete(tentativesConnexion).where(eq(tentativesConnexion.telephone, telephone));
}

export async function connecter(deps: AuthDeps, brut: string, motDePasse: string) {
  const telephone = normaliserTelephone(brut);
  await verifierNonVerrouille(deps.db, telephone);
  const [u] = await deps.db.select().from(users).where(eq(users.telephone, telephone)).limit(1);
  const ok = u ? await verifierMotDePasse(motDePasse, u.motDePasseHash) : false;
  if (!u || !ok) {
    await enregistrerEchec(deps.db, telephone);
    throw unauthorized('Téléphone ou mot de passe incorrect');
  }
  await reinitialiserEchecs(deps.db, telephone);
  const session = await ouvrirSession(deps, u);
  await journaliser(deps.db, { acteurId: u.id, action: 'CONNEXION', cibleType: 'utilisateur', cibleId: u.id, details: { role: u.role } });
  return session;
}

// Demande de code de renouvellement. La réponse est identique que le compte existe ou non.
// Le code n'est envoyé par SMS que si le compte existe.
export async function demanderReinitialisation(deps: AuthDeps, brut: string, ip?: string): Promise<{ expireDans: number; mode: 'SMS' | 'ASSISTE' }> {
  const telephone = normaliserTelephone(brut);
  // Mode assisté : rien n'est envoyé. Le client s'adresse à NZE, qui lui transmet un code (voir genererCodeAssiste).
  if (deps.recuperationAssistee) return { expireDans: 0, mode: 'ASSISTE' };
  if (ip) {
    const [{ nombreIp }] = await deps.db
      .select({ nombreIp: count() })
      .from(otpCodes)
      .where(and(eq(otpCodes.ip, ip), gt(otpCodes.createdAt, new Date(Date.now() - OTP_FENETRE_MS))));
    if (nombreIp >= OTP_MAX_DEMANDES_PAR_IP) {
      throw tooManyRequests('Trop de demandes depuis cette connexion. Réessayez dans quelques minutes.');
    }
  }
  const [{ nombre }] = await deps.db
    .select({ nombre: count() })
    .from(otpCodes)
    .where(and(eq(otpCodes.telephone, telephone), gt(otpCodes.createdAt, new Date(Date.now() - OTP_FENETRE_MS))));
  if (nombre >= OTP_MAX_DEMANDES) {
    throw tooManyRequests('Trop de demandes de code. Réessayez dans quelques minutes.');
  }
  const code = newOtp();
  await deps.db.insert(otpCodes).values({
    telephone,
    codeHash: hashOtp(code, telephone, deps.sessionSecret),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
    ip: ip ?? null,
  });
  const [u] = await deps.db.select({ id: users.id }).from(users).where(eq(users.telephone, telephone)).limit(1);
  if (u) await deps.sender.send(telephone, code);
  return { expireDans: OTP_TTL_MS / 1000, mode: 'SMS' };
}

async function verifierCodeOtp(deps: AuthDeps, telephone: string, code: string): Promise<void> {
  const [otp] = await deps.db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.telephone, telephone), gt(otpCodes.expiresAt, new Date())))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);
  if (!otp) throw unauthorized('Code expiré ou inexistant. Demandez un nouveau code.');
  if (otp.tentatives >= OTP_MAX_TENTATIVES) throw forbidden('Trop de tentatives. Demandez un nouveau code.');
  if (hashOtp(code, telephone, deps.sessionSecret) !== otp.codeHash) {
    await deps.db.update(otpCodes).set({ tentatives: otp.tentatives + 1 }).where(eq(otpCodes.id, otp.id));
    throw unauthorized('Code incorrect');
  }
  await deps.db.delete(otpCodes).where(eq(otpCodes.telephone, telephone));
}

// Mode assisté : l'administrateur principal, après avoir vérifié l'identité du client par téléphone, génère un code à usage unique
// (valable 5 minutes, mêmes règles que le code SMS). Le code n'est jamais journalisé.
export async function genererCodeAssiste(deps: AuthDeps, brut: string, acteurId: string) {
  if (!deps.recuperationAssistee) throw conflict('La récupération assistée n’est pas activée');
  const telephone = normaliserTelephone(brut);
  const [u] = await deps.db.select({ id: users.id }).from(users).where(eq(users.telephone, telephone)).limit(1);
  if (!u) throw notFound('Compte introuvable');
  const [{ nombre }] = await deps.db
    .select({ nombre: count() })
    .from(otpCodes)
    .where(and(eq(otpCodes.telephone, telephone), gt(otpCodes.createdAt, new Date(Date.now() - OTP_FENETRE_MS))));
  if (nombre >= OTP_MAX_DEMANDES) throw tooManyRequests('Trop de codes générés pour ce compte. Réessayez dans quelques minutes.');
  const code = newOtp();
  await deps.db.insert(otpCodes).values({
    telephone,
    codeHash: hashOtp(code, telephone, deps.sessionSecret),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
    ip: null,
  });
  await journaliser(deps.db, { acteurId, action: 'RECUPERATION_ASSISTEE_CODE', cibleType: 'utilisateur', cibleId: u.id });
  return { code, expireDans: OTP_TTL_MS / 1000 };
}

// Nouveau mot de passe après code. Toutes les sessions existantes sont fermées.
export async function reinitialiserMotDePasse(deps: AuthDeps, brut: string, code: string, nouveau: string) {
  const telephone = normaliserTelephone(brut);
  validerMotDePasse(nouveau);
  await verifierCodeOtp(deps, telephone, code);
  const [u] = await deps.db.select().from(users).where(eq(users.telephone, telephone)).limit(1);
  if (!u) throw unauthorized('Compte introuvable');
  await deps.db.update(users).set({ motDePasseHash: await hashMotDePasse(nouveau) }).where(eq(users.id, u.id));
  await deps.db.delete(sessions).where(eq(sessions.userId, u.id));
  await journaliser(deps.db, { acteurId: u.id, action: 'MOT_DE_PASSE_REINITIALISE', cibleType: 'utilisateur', cibleId: u.id });
  return ouvrirSession(deps, u);
}

// Changement volontaire, compte connecté. Toutes les sessions sont fermées, une nouvelle est ouverte.
export async function changerMotDePasse(deps: AuthDeps, user: AuthUser, ancien: string, nouveau: string) {
  validerMotDePasse(nouveau);
  const [u] = await deps.db.select().from(users).where(eq(users.id, user.id)).limit(1);
  if (!u || !(await verifierMotDePasse(ancien, u.motDePasseHash))) throw unauthorized('Mot de passe actuel incorrect');
  await deps.db.update(users).set({ motDePasseHash: await hashMotDePasse(nouveau) }).where(eq(users.id, u.id));
  await deps.db.delete(sessions).where(eq(sessions.userId, u.id));
  await journaliser(deps.db, { acteurId: u.id, action: 'MOT_DE_PASSE_CHANGE', cibleType: 'utilisateur', cibleId: u.id });
  return ouvrirSession(deps, u);
}

// Crée ou promeut un administrateur hors connexion (commande creer-admin, ou administrateur principal).
// Le compte n'a pas de mot de passe : il le définit par « mot de passe oublié ».
export async function creerAdministrateur(db: Db, brut: string, role: 'admin_principal' | 'admin_secondaire') {
  const telephone = normaliserTelephone(brut);
  const [existant] = await db.select().from(users).where(eq(users.telephone, telephone)).limit(1);
  if (existant) {
    const [u] = await db.update(users).set({ role }).where(eq(users.id, existant.id)).returning();
    return { id: u.id, role: u.role, telephone };
  }
  const [u] = await db.insert(users).values({ telephone, role }).returning();
  return { id: u.id, role: u.role, telephone };
}
