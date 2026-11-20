import type { Page } from '../../core/pagination.ts';
// Paiement échelonné (amendements V3.2). Un plan lie une commande à ses encaissements :
// l'avance (40 %), puis des versements libres. Chaque encaissement est réparti entre le commerçant, la commission et la livraison,
// et n'est versé au commerçant qu'une fois encaissé. Aucune pénalité de retard, aucun blocage de commande : des notifications.
import { and, desc, eq, gt, inArray } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import { commandes, ecritures, lignesCommande, notifications, plansEcheloneces, produits, reglages, transactions, users, versementsEcheloneces } from '../../db/schema.ts';
import { AppError, badRequest, conflict, notFound } from '../../core/errors.ts';
import { log } from '../../core/logger.ts';
import type { AuthUser } from '../../core/auth.ts';
import type { Cartographie } from '../cartographie/index.ts';
import type { MyPvitClient } from '../paiements/providers/mypvit/index.ts';
import { journaliser } from '../audit/service.ts';
import { notifier } from '../notifications/service.ts';
import { libererPourCommande, reserverPourCommande, verifierDisponibilite, vendrePourCommande } from '../stock/service.ts';
import { calculerLivraison, figerLivraisonCommande, type Tx } from '../commandes/livraison-commande.ts';
import { BORNES, BORNES_PENALITE_FCFA, MAX_ARTICLES_ECHELONNES, PARAMETRES_DEFAUT, PENALITE_PAR_MOIS_DEFAUT_FCFA, echeancierArticle, situation, verifierBorne, verifierParametres, verifierVersement, ventiler, type ParametresEchelonnement } from './regles.ts';
import { echeanciersArticles } from '../../db/schema.ts';
import { affecterVersement, aDesEcheanciers, alertesPlan, appliquerPenalites, echeancesPourCommercant, ouvrirEcheances, penalitesPayeesPlan, penalitesRestantesPlan, relancerEcheancesMois, resoudreArticle, soldeArticle } from './echeances.ts';

export const CLE_ECHELONNEMENT = 'echelonnement_actif';
export const CLE_PARAMETRES = 'echelonnement_parametres';
const JOUR_MS = 24 * 60 * 60 * 1000;
const RELANCE_AVANT_MS = 3 * JOUR_MS;

export interface EchelonnementDeps {
  db: Db;
  mypvit: MyPvitClient;
  cartographie: Cartographie;
  redirections: { successCode: string; failureCode: string };
}

export interface ChoixPaiement {
  canal: 'MOBILE_MONEY' | 'CARTE';
  operateur?: string;
  numero?: string;
}

// Désactivé par défaut : activation explicite par l'administrateur principal après validation juridique et de trésorerie.
export async function echelonnementActif(db: Db): Promise<boolean> {
  const [r] = await db.select({ valeur: reglages.valeur }).from(reglages).where(eq(reglages.cle, CLE_ECHELONNEMENT)).limit(1);
  return r ? r.valeur === 'ACTIF' : false;
}

export async function definirEchelonnement(db: Db, admin: AuthUser, actif: boolean) {
  const valeur = actif ? 'ACTIF' : 'INACTIF';
  await db.transaction(async (tx) => {
    await tx
      .insert(reglages)
      .values({ cle: CLE_ECHELONNEMENT, valeur, acteurId: admin.id, misAJourLe: new Date() })
      .onConflictDoUpdate({ target: reglages.cle, set: { valeur, acteurId: admin.id, misAJourLe: new Date() } });
    await journaliser(tx, { acteurId: admin.id, action: 'ECHELONNEMENT_DEFINI', cibleType: 'reglage', cibleId: CLE_ECHELONNEMENT, details: { actif } });
  });
  return { actif };
}

// Acompte et durée maximale de l'offre. Valeurs initiales tant qu'elles ne sont pas définies.
export async function lireParametresEchelonnement(db: Db): Promise<ParametresEchelonnement> {
  const [r] = await db.select({ valeur: reglages.valeur }).from(reglages).where(eq(reglages.cle, CLE_PARAMETRES)).limit(1);
  if (!r) return { ...PARAMETRES_DEFAUT };
  try {
    const v = JSON.parse(r.valeur);
    return verifierParametres({ avancePourcent: v.avancePourcent, dureeMaxMois: v.dureeMaxMois });
  } catch {
    return { ...PARAMETRES_DEFAUT };
  }
}

// Ne s'applique qu'aux plans créés après ce changement : les plans existants gardent leurs montants.
export async function definirParametresEchelonnement(db: Db, admin: AuthUser, saisie: ParametresEchelonnement) {
  const p = verifierParametres(saisie);
  const valeur = JSON.stringify(p);
  await db.transaction(async (tx) => {
    await tx
      .insert(reglages)
      .values({ cle: CLE_PARAMETRES, valeur, acteurId: admin.id, misAJourLe: new Date() })
      .onConflictDoUpdate({ target: reglages.cle, set: { valeur, acteurId: admin.id, misAJourLe: new Date() } });
    await journaliser(tx, { acteurId: admin.id, action: 'ECHELONNEMENT_PARAMETRES', cibleType: 'reglage', cibleId: CLE_PARAMETRES, details: { avancePourcent: p.avancePourcent, dureeMaxMois: p.dureeMaxMois } });
  });
  return p;
}

async function partenairesDe(tx: Db | Tx, entrepriseId: string): Promise<string[]> {
  const rows = await tx.select({ id: users.id }).from(users).where(and(eq(users.entrepriseId, entrepriseId), eq(users.role, 'partenaire')));
  return rows.map((r) => r.id);
}

async function chargerPlan(db: Db | Tx, planId: string) {
  const [p] = await db.select().from(plansEcheloneces).where(eq(plansEcheloneces.id, planId)).limit(1);
  if (!p) throw notFound('Paiement échelonné introuvable');
  return p;
}

async function versementsDuPlan(db: Db | Tx, planId: string) {
  return db.select().from(versementsEcheloneces).where(eq(versementsEcheloneces.planId, planId)).orderBy(versementsEcheloneces.creeLe);
}

// Versements encaissés qui réduisent le reste (hors avance).
function encaissesHorsAvance(vs: { type: string; statut: string; montantFcfa: number; encaisseLe: Date | null }[]) {
  return vs.filter((v) => v.type === 'VERSEMENT' && v.statut === 'ENCAISSE');
}

function situationDuPlan(p: { resteFcfa: number; mensualiteFcfa: number; dateDebut: Date | null }, vs: { type: string; statut: string; montantFcfa: number; encaisseLe: Date | null }[], maintenant: Date) {
  if (!p.dateDebut) return null;
  return situation({
    resteInitialFcfa: p.resteFcfa,
    mensualiteFcfa: p.mensualiteFcfa,
    dateDebut: p.dateDebut,
    versements: encaissesHorsAvance(vs).map((v) => ({ montantFcfa: v.montantFcfa, date: v.encaisseLe ?? p.dateDebut! })),
    maintenant,
  });
}

// Présentation client : ce qu'il a payé, ce qu'il doit, le calendrier, les retards. Aucune donnée d'un autre client.
function presenterPourClient(p: typeof plansEcheloneces.$inferSelect, vs: typeof versementsEcheloneces.$inferSelect[], articles: { nom: string; quantite: number }[], reference: string, maintenant = new Date()) {
  const s = situationDuPlan(p, vs, maintenant);
  const payeFcfa = p.avanceFcfa * (vs.some((v) => v.type === 'AVANCE' && v.statut === 'ENCAISSE') ? 1 : 0) + encaissesHorsAvance(vs).reduce((t, v) => t + v.montantFcfa, 0);
  return {
    id: p.id,
    commandeReference: reference,
    statut: p.statut,
    totalFcfa: p.totalFcfa,
    avanceFcfa: p.avanceFcfa,
    resteFcfa: p.resteFcfa,
    mensualiteFcfa: p.mensualiteFcfa,
    payeFcfa,
    restantFcfa: p.totalFcfa - payeFcfa,
    dueCetteEcheanceFcfa: s?.dueCetteEcheanceFcfa ?? 0,
    enRetard: s?.enRetard ?? false,
    prochainesEcheances: s?.echeances ?? [],
    dateDebut: p.dateDebut,
    articles,
    versements: vs.map((v) => ({ id: v.id, type: v.type, montantFcfa: v.montantFcfa, statut: v.statut, encaisseLe: v.encaisseLe })),
  };
}

async function articlesDeCommande(db: Db | Tx, commandeId: string) {
  return db
    .select({ nom: produits.nom, quantite: lignesCommande.quantite, produitId: lignesCommande.produitId })
    .from(lignesCommande)
    .innerJoin(produits, eq(produits.id, lignesCommande.produitId))
    .where(eq(lignesCommande.commandeId, commandeId));
}

// ---------- Création du plan ----------

export async function creerPlan(deps: EchelonnementDeps, user: AuthUser, commandeId: string, mensualiteSaisieFcfa?: number) {
  if (!(await echelonnementActif(deps.db))) {
    throw new AppError(409, 'ECHELONNEMENT_DESACTIVE', 'Le paiement échelonné est suspendu par NZE.');
  }
  const [c0] = await deps.db.select().from(commandes).where(and(eq(commandes.id, commandeId), eq(commandes.userId, user.id))).limit(1);
  if (!c0) throw notFound('Commande introuvable');
  if (c0.statut !== 'PANIER') throw conflict('Cette commande n’est plus au panier');
  const lignes = await deps.db.select().from(lignesCommande).where(eq(lignesCommande.commandeId, commandeId));
  if (lignes.length === 0) throw badRequest('La commande est vide');
  if (lignes.length > MAX_ARTICLES_ECHELONNES) {
    throw badRequest(`Le paiement échelonné concerne au maximum ${MAX_ARTICLES_ECHELONNES} articles`);
  }
  const entrepriseIds = [...new Set(lignes.map((l) => l.entrepriseId))];
  if (entrepriseIds.length > 1) throw badRequest('Un paiement échelonné porte sur les articles d’un seul commerçant. Séparez les achats.');
  const articles = await articlesDeCommande(deps.db, commandeId);
  const pasEchelonnables = await deps.db
    .select({ nom: produits.nom })
    .from(produits)
    .where(and(inArray(produits.id, lignes.map((l) => l.produitId)), eq(produits.echelonnable, false)));
  if (pasEchelonnables.length > 0) {
    throw badRequest(`Article non disponible en paiement échelonné : ${pasEchelonnables[0].nom}`);
  }
  await verifierDisponibilite(deps.db, lignes.map((l) => ({ produitId: l.produitId, quantite: l.quantite })));

  const livraison = await calculerLivraison(deps, c0, lignes);
  const sousTotal = c0.sousTotalFcfa;
  const total = sousTotal + livraison.frais;
  const parametres = await lireParametresEchelonnement(deps.db);
  const echeanciers = await calculerEcheanciers(deps.db, lignes, parametres);
  // La livraison est réglée avec l'avance ; le reste et les mensualités viennent des articles.
  const avance = echeanciers.reduce((t, a) => t + a.avanceFcfa, 0) + livraison.frais;
  const reste = echeanciers.reduce((t, a) => t + a.resteFcfa, 0);
  const mensualiteBase = echeanciers.reduce((t, a) => t + a.mensualiteFcfa, 0);
  if (mensualiteSaisieFcfa !== undefined && mensualiteSaisieFcfa < mensualiteBase) {
    throw badRequest(`La mensualité doit être d'au moins ${mensualiteBase} FCFA`);
  }
  const commission = lignes.reduce((t, l) => t + l.commissionFcfa, 0);
  const entrepriseId = entrepriseIds[0];

  return deps.db.transaction(async (tx) => {
    const [cmd] = await tx.select().from(commandes).where(eq(commandes.id, commandeId)).for('update');
    if (!cmd || cmd.statut !== 'PANIER') throw conflict('Cette commande n’est plus au panier');
    await figerLivraisonCommande(tx, commandeId, sousTotal, livraison);
    await tx.update(commandes).set({ statut: 'EN_ATTENTE_PAIEMENT' }).where(eq(commandes.id, commandeId));
    const [p] = await tx
      .insert(plansEcheloneces)
      .values({
        commandeId, clientId: user.id, entrepriseId, statut: 'PROPOSE', totalFcfa: total, avanceFcfa: avance, resteFcfa: reste,
        mensualiteFcfa: mensualiteBase, nombreArticles: lignes.length, commercantTotalFcfa: sousTotal - commission, commissionTotalFcfa: commission,
        livraisonTotalFcfa: livraison.frais,
      })
      .returning();
    await tx.insert(echeanciersArticles).values(echeanciers.map((a) => ({
      planId: p.id, ligneId: a.ligneId, produitId: a.produitId, prixFcfa: a.prixFcfa, avancePourcent: a.avancePourcent,
      avanceFcfa: a.avanceFcfa, resteFcfa: a.resteFcfa, dureeMois: a.dureeMois, mensualiteFcfa: a.mensualiteFcfa, dernierMoisFcfa: a.dernierMoisFcfa,
    })));
    await journaliser(tx, { acteurId: user.id, action: 'ECHELONNEMENT_PROPOSE', cibleType: 'plan_echelonne', cibleId: p.id, details: { totalFcfa: total, avanceFcfa: avance, mensualiteFcfa: mensualiteBase, nombreArticles: lignes.length } });
    await notifier(tx, { destinataireId: user.id, type: 'ECHELONNEMENT_PROPOSE', titre: 'Paiement échelonné proposé', message: `Avance de ${avance} FCFA, puis ${mensualiteBase} FCFA par mois au plus ${parametres.dureeMaxMois} mois. Vous pouvez régler l’avance depuis votre suivi.`, cibleType: 'plan_echelonne', cibleId: p.id });
    return presenterPourClient(p, [], articles, cmd.reference);
  });
}

// ---------- Paiements MyPVit (avance et versements) ----------

async function lancerPaiement(deps: EchelonnementDeps, t: { id: string; referenceMarchand: string; versementId: string }, montant: number, libelle: string, choix: ChoixPaiement) {
  try {
    if (choix.canal === 'MOBILE_MONEY') {
      const r = await deps.mypvit.initiatePayment({
        reference: t.referenceMarchand, amount: montant, operatorCode: choix.operateur!, customerMsisdn: choix.numero!, freeInfo: libelle,
      });
      await deps.db.update(transactions).set({ referenceFournisseur: r.referenceId, statut: r.nzeStatus, dernierControle: new Date() }).where(eq(transactions.id, t.id));
      if (r.nzeStatus === 'FAILED') {
        await deps.db.transaction(async (tx) => {
          await tx.update(transactions).set({ statut: 'FAILED', dernierControle: new Date() }).where(eq(transactions.id, t.id));
          await echecVersement(tx, t.versementId);
        });
      }
      return { transactionId: t.id, statut: r.nzeStatus, urlPaiement: null };
    }
    const lien = await deps.mypvit.createPaymentLink({
      reference: t.referenceMarchand, amount: montant, successCode: deps.redirections.successCode, failureCode: deps.redirections.failureCode, freeInfo: libelle,
    });
    await deps.db.update(transactions).set({ urlPaiement: lien.checkoutUrl }).where(eq(transactions.id, t.id));
    return { transactionId: t.id, statut: 'PENDING' as const, urlPaiement: lien.checkoutUrl };
  } catch (err) {
    // Résultat inconnu : ni succès ni échec supposé. Le paiement sera vérifié avant toute nouvelle tentative.
    await deps.db.update(transactions).set({ statut: 'UNCERTAIN' }).where(eq(transactions.id, t.id));
    log('error', 'echelonnement_initiation_incertaine', { transaction: t.id });
    throw err;
  }
}

async function ouvrirEncaissement(db: Db, p: typeof plansEcheloneces.$inferSelect, type: 'AVANCE' | 'VERSEMENT', montant: number, echeancierId: string | null = null) {
  return db.transaction(async (tx) => {
    const [v] = await tx.insert(versementsEcheloneces).values({ planId: p.id, type, montantFcfa: montant, statut: 'EN_ATTENTE', echeancierId }).returning();
    const [cmd] = await tx.select({ reference: commandes.reference }).from(commandes).where(eq(commandes.id, p.commandeId)).for('update');
    // L'avance réserve les articles dès le lancement du paiement ; un versement ne touche pas au stock.
    if (type === 'AVANCE') {
      const lignes = await tx.select({ produitId: lignesCommande.produitId, quantite: lignesCommande.quantite }).from(lignesCommande).where(eq(lignesCommande.commandeId, p.commandeId));
      await reserverPourCommande(tx, p.commandeId, lignes);
    }
    const deja = await tx.select({ id: transactions.id }).from(transactions).where(eq(transactions.commandeId, p.commandeId));
    const [t] = await tx
      .insert(transactions)
      .values({ commandeId: p.commandeId, canal: 'MOBILE_MONEY', referenceMarchand: `${cmd.reference}-E${deja.length + 1}`, montantFcfa: montant, statut: 'PENDING', versementId: v.id })
      .returning();
    return { versement: v, transaction: t, reference: cmd.reference };
  });
}

async function paiementEnCours(db: Db, planId: string) {
  const [en] = await db
    .select({ id: versementsEcheloneces.id })
    .from(versementsEcheloneces)
    .where(and(eq(versementsEcheloneces.planId, planId), eq(versementsEcheloneces.statut, 'EN_ATTENTE')))
    .limit(1);
  return Boolean(en);
}

export async function payerAvance(deps: EchelonnementDeps, user: AuthUser, planId: string, choix: ChoixPaiement) {
  const p = await chargerPlan(deps.db, planId);
  if (p.clientId !== user.id) throw notFound('Paiement échelonné introuvable');
  if (p.statut !== 'PROPOSE') throw conflict('L’avance a déjà été réglée ou le plan n’est plus proposé');
  if (await paiementEnCours(deps.db, planId)) throw conflict('Un paiement est déjà en cours sur ce plan');
  const { transaction, reference } = await ouvrirEncaissement(deps.db, p, 'AVANCE', p.avanceFcfa);
  return lancerPaiement(deps, { id: transaction.id, referenceMarchand: transaction.referenceMarchand, versementId: transaction.versementId! }, p.avanceFcfa, reference, choix);
}

export async function payerVersement(deps: EchelonnementDeps, user: AuthUser, planId: string, montantFcfa: number, choix: ChoixPaiement, echeancierSaisi?: string) {
  const p = await chargerPlan(deps.db, planId);
  if (p.clientId !== user.id) throw notFound('Paiement échelonné introuvable');
  if (p.statut !== 'ACTIF') throw conflict('Ce plan n’accepte pas de versement pour le moment');
  if (await paiementEnCours(deps.db, planId)) throw conflict('Un paiement est déjà en cours sur ce plan');
  const vs = await versementsDuPlan(deps.db, planId);
  const dejaVerse = encaissesHorsAvance(vs).reduce((t, v) => t + v.montantFcfa, 0);
  const echeancierId = await resoudreArticle(deps.db, planId, echeancierSaisi);
  if (echeancierId) {
    verifierVersement((await soldeArticle(deps.db, echeancierId)).total, montantFcfa);
  } else {
    verifierVersement(p.resteFcfa - dejaVerse, montantFcfa);
  }
  const { transaction, reference } = await ouvrirEncaissement(deps.db, p, 'VERSEMENT', montantFcfa, echeancierId);
  return lancerPaiement(deps, { id: transaction.id, referenceMarchand: transaction.referenceMarchand, versementId: transaction.versementId! }, montantFcfa, reference, choix);
}

// ---------- Encaissement effectif (appelé quand MyPVit confirme le paiement) ----------

export async function encaisserVersement(tx: Tx, versementId: string): Promise<void> {
  const [v] = await tx.select().from(versementsEcheloneces).where(eq(versementsEcheloneces.id, versementId)).for('update');
  if (!v) throw notFound('Versement introuvable');
  if (v.statut === 'ENCAISSE') return;
  const p = await chargerPlan(tx, v.planId);
  const vs = await versementsDuPlan(tx, p.id);
  // Les pénalités payées ne font pas partie du prix de l'achat : elles sont retirées du cumul.
  const cumulAvant = vs.filter((x) => x.statut === 'ENCAISSE').reduce((t, x) => t + x.montantFcfa, 0) - (await penalitesPayeesPlan(tx, p.id));
  // Un versement sur un article : d'abord les mois, puis les pénalités dues.
  const penalitesVersement = v.type === 'VERSEMENT' && v.echeancierId ? await affecterVersement(tx, v.id, v.echeancierId, v.montantFcfa) : 0;
  const partsPrincipal = ventiler({
    montantFcfa: v.montantFcfa - penalitesVersement,
    cumulAvantFcfa: cumulAvant,
    totalFcfa: p.totalFcfa,
    parts: { commercantFcfa: p.commercantTotalFcfa, commissionFcfa: p.commissionTotalFcfa, livraisonFcfa: p.livraisonTotalFcfa },
  });
  // Les pénalités reviennent à NZE : elles s'ajoutent à la commission, jamais à la part du commerçant.
  const parts = { ...partsPrincipal, commissionFcfa: partsPrincipal.commissionFcfa + penalitesVersement };
  const maintenant = new Date();
  await tx
    .update(versementsEcheloneces)
    .set({ statut: 'ENCAISSE', commercantFcfa: parts.commercantFcfa, commissionFcfa: parts.commissionFcfa, livraisonFcfa: parts.livraisonFcfa, encaisseLe: maintenant })
    .where(eq(versementsEcheloneces.id, versementId));

  // Écritures comptables de cet encaissement : c'est ce qui crédite le solde du commerçant, au fil de l'argent encaissé.
  const lignesEcritures: (typeof ecritures.$inferInsert)[] = [];
  if (parts.commercantFcfa > 0) lignesEcritures.push({ commandeId: p.commandeId, entrepriseId: p.entrepriseId, categorie: 'VENTE_NET', montantFcfa: parts.commercantFcfa });
  if (parts.commissionFcfa > 0) lignesEcritures.push({ commandeId: p.commandeId, entrepriseId: null, categorie: 'COMMISSION', montantFcfa: parts.commissionFcfa });
  if (parts.livraisonFcfa > 0) lignesEcritures.push({ commandeId: p.commandeId, entrepriseId: null, categorie: 'FRAIS_LIVRAISON', montantFcfa: parts.livraisonFcfa });
  if (lignesEcritures.length > 0) await tx.insert(ecritures).values(lignesEcritures);

  const partenaires = await partenairesDe(tx, p.entrepriseId);
  if (v.type === 'AVANCE') {
    // L'avance valide la commande : les articles sont vendus, le plan démarre.
    await tx.select().from(commandes).where(eq(commandes.id, p.commandeId)).for('update');
    const lignes = await tx.select().from(lignesCommande).where(eq(lignesCommande.commandeId, p.commandeId));
    await vendrePourCommande(tx, p.commandeId, lignes.map((l) => ({ produitId: l.produitId, quantite: l.quantite })));
    await tx.update(commandes).set({ statut: 'PAYEE', payeLe: maintenant }).where(eq(commandes.id, p.commandeId));
    await tx.update(plansEcheloneces).set({ statut: 'ACTIF', dateDebut: maintenant }).where(eq(plansEcheloneces.id, p.id));
    await ouvrirEcheances(tx, p.id, maintenant);
    const s = situation({ resteInitialFcfa: p.resteFcfa, mensualiteFcfa: p.mensualiteFcfa, dateDebut: maintenant, versements: [], maintenant });
    await notifier(tx, { destinataireId: p.clientId, type: 'ECHELONNEMENT_ACTIF', titre: 'Paiement échelonné démarré', message: `Avance réglée. Reste ${p.resteFcfa} FCFA, en mensualités de ${p.mensualiteFcfa} FCFA. Première échéance le ${s.echeances[0]?.date.toISOString().slice(0, 10) ?? '—'}.`, cibleType: 'plan_echelonne', cibleId: p.id });
    for (const id of partenaires) {
      await notifier(tx, { destinataireId: id, type: 'ECHELONNEMENT_ACTIF', titre: 'Vente échelonnée démarrée', message: `Avance encaissée : ${parts.commercantFcfa} FCFA vous reviennent maintenant. Le reste vous sera versé au fur et à mesure des encaissements.`, cibleType: 'plan_echelonne', cibleId: p.id });
    }
  } else {
    const total = cumulAvant + (v.montantFcfa - penalitesVersement);
    if (total >= p.totalFcfa && (await penalitesRestantesPlan(tx, p.id)) === 0) {
      await tx.update(plansEcheloneces).set({ statut: 'SOLDE' }).where(eq(plansEcheloneces.id, p.id));
    }
    const restant = Math.max(0, p.totalFcfa - total);
    await notifier(tx, { destinataireId: p.clientId, type: 'VERSEMENT_ENREGISTRE', titre: 'Versement enregistré', message: restant === 0 ? 'Votre paiement échelonné est soldé. Merci.' : `Versement de ${v.montantFcfa} FCFA enregistré. Il vous reste ${restant} FCFA à régler.`, cibleType: 'plan_echelonne', cibleId: p.id });
    for (const id of partenaires) {
      await notifier(tx, { destinataireId: id, type: 'ENCAISSEMENT_ECHELONNE', titre: 'Encaissement reçu', message: `${parts.commercantFcfa} FCFA vous reviennent sur ce versement.`, cibleType: 'plan_echelonne', cibleId: p.id });
    }
  }
  await journaliser(tx, { acteurId: null, action: 'ECHELONNEMENT_ENCAISSE', cibleType: 'plan_echelonne', cibleId: p.id, details: { type: v.type, montantFcfa: v.montantFcfa, commercantFcfa: parts.commercantFcfa } });
}

export async function echecVersement(tx: Tx, versementId: string): Promise<void> {
  const [v] = await tx.select().from(versementsEcheloneces).where(eq(versementsEcheloneces.id, versementId)).for('update');
  if (!v || v.statut !== 'EN_ATTENTE') return;
  await tx.update(versementsEcheloneces).set({ statut: 'ECHEC' }).where(eq(versementsEcheloneces.id, versementId));
  const p = await chargerPlan(tx, v.planId);
  if (v.type === 'AVANCE') await libererPourCommande(tx, p.commandeId);
  await notifier(tx, { destinataireId: p.clientId, type: 'PAIEMENT_ECHOUE', titre: 'Paiement non abouti', message: 'Un paiement échelonné n’a pas abouti. Vous pouvez réessayer depuis votre suivi. Aucune pénalité.', cibleType: 'plan_echelonne', cibleId: p.id });
}

// ---------- Suivi client ----------

export async function mesPlans(db: Db, user: AuthUser) {
  const plans = await db.select().from(plansEcheloneces).where(eq(plansEcheloneces.clientId, user.id)).orderBy(desc(plansEcheloneces.creeLe));
  const sortie = [];
  for (const p of plans) {
    const vs = await versementsDuPlan(db, p.id);
    const [cmd] = await db.select({ reference: commandes.reference }).from(commandes).where(eq(commandes.id, p.commandeId)).limit(1);
    sortie.push({ ...presenterPourClient(p, vs, await articlesDeCommande(db, p.commandeId), cmd.reference), ...(await alertesPlan(db, p.id)) });
  }
  return sortie;
}

export async function monPlan(db: Db, user: AuthUser, planId: string) {
  const p = await chargerPlan(db, planId);
  if (p.clientId !== user.id) throw notFound('Paiement échelonné introuvable');
  const vs = await versementsDuPlan(db, planId);
  const [cmd] = await db.select({ reference: commandes.reference }).from(commandes).where(eq(commandes.id, p.commandeId)).limit(1);
  return { ...presenterPourClient(p, vs, await articlesDeCommande(db, p.commandeId), cmd.reference), ...(await alertesPlan(db, planId)) };
}

// ---------- Suivi commerçant : ce qui a été payé, ce qui est en cours, ce qui lui revient ----------

export async function plansDuCommercant(db: Db, entrepriseId: string) {
  const plans = await db.select().from(plansEcheloneces).where(eq(plansEcheloneces.entrepriseId, entrepriseId)).orderBy(desc(plansEcheloneces.creeLe));
  const sortie = [];
  for (const p of plans) {
    const vs = await versementsDuPlan(db, p.id);
    const [cmd] = await db.select({ reference: commandes.reference }).from(commandes).where(eq(commandes.id, p.commandeId)).limit(1);
    const encaisseCommercant = vs.filter((v) => v.statut === 'ENCAISSE').reduce((t, v) => t + (v.commercantFcfa ?? 0), 0);
    const s = situationDuPlan(p, vs, new Date());
    const alerte = await alertesPlan(db, p.id);
    sortie.push({
      id: p.id,
      commandeReference: cmd.reference,
      dateCommande: p.creeLe,
      articles: await articlesDeCommande(db, p.commandeId),
      statut: p.statut,
      totalFcfa: p.totalFcfa,
      commercantTotalFcfa: p.commercantTotalFcfa,
      commercantEncaisseFcfa: encaisseCommercant,
      commercantAVerserFcfa: p.commercantTotalFcfa - encaisseCommercant,
      echeancesArticles: await echeancesPourCommercant(db, p.id),
      dueCetteEcheanceFcfa: alerte ? alerte.dueCetteEcheanceFcfa : (s?.dueCetteEcheanceFcfa ?? 0),
      enRetard: alerte ? alerte.enRetard : (s?.enRetard ?? false),
      encaissements: vs
        .filter((v) => v.statut === 'ENCAISSE')
        .map((v) => ({ type: v.type, montantFcfa: v.montantFcfa, partCommercantFcfa: v.commercantFcfa, encaisseLe: v.encaisseLe })),
    });
  }
  return sortie;
}

// ---------- Administration : contrôle complet ----------

// Le retard se calcule à partir des versements : le filtre s'applique donc après lecture, lot par lot,
// jusqu'à remplir la page demandée. Ainsi un plan en retard n'est jamais perdu au-delà d'une limite de lignes.
export async function listerPlansAdmin(db: Db, filtres: { statut?: string; enRetard?: boolean }, page: Page) {
  const maintenant = new Date();
  const sortie = [];
  const LOT = 200;
  let curseur = 0;
  let aSauter = page.decalage;
  while (sortie.length < page.limite) {
    const plans = await db
      .select()
      .from(plansEcheloneces)
      .where(filtres.statut ? eq(plansEcheloneces.statut, filtres.statut) : undefined)
      .orderBy(desc(plansEcheloneces.creeLe), desc(plansEcheloneces.id))
      .limit(LOT)
      .offset(curseur);
    if (plans.length === 0) break;
    for (const p of plans) {
      if (sortie.length >= page.limite) break;
      const vs = await versementsDuPlan(db, p.id);
      const s = situationDuPlan(p, vs, maintenant);
      // Retard calculé par article ; ancien calcul seulement pour les plans antérieurs à l'échéancier par article.
      const alerte = await alertesPlan(db, p.id, maintenant);
      const enRetard = alerte ? alerte.enRetard : (s?.enRetard ?? false);
      if (filtres.enRetard !== undefined && enRetard !== filtres.enRetard) continue;
      if (aSauter > 0) { aSauter--; continue; }
    const [cmd] = await db.select({ reference: commandes.reference }).from(commandes).where(eq(commandes.id, p.commandeId)).limit(1);
    const [client] = await db.select({ nomAffiche: users.nomAffiche, telephone: users.telephone }).from(users).where(eq(users.id, p.clientId)).limit(1);
    sortie.push({
      id: p.id,
      commandeReference: cmd.reference,
      client: { nom: client.nomAffiche, telephone: client.telephone },
      statut: p.statut,
      totalFcfa: p.totalFcfa,
      payeFcfa: p.avanceFcfa * (vs.some((v) => v.type === 'AVANCE' && v.statut === 'ENCAISSE') ? 1 : 0) + encaissesHorsAvance(vs).reduce((t, v) => t + v.montantFcfa, 0),
      restantFcfa: p.totalFcfa - (vs.filter((v) => v.statut === 'ENCAISSE').reduce((t, v) => t + v.montantFcfa, 0)),
      dueCetteEcheanceFcfa: s?.dueCetteEcheanceFcfa ?? 0,
      enRetard,
      creeLe: p.creeLe,
    });
    }
    curseur += plans.length;
    if (plans.length < LOT) break;
  }
  return sortie;
}

export async function syntheseAdmin(db: Db) {
  // Totaux sur l'ensemble des plans : lecture complète, lot par lot (une page unique tronquerait les montants).
  const plans: Awaited<ReturnType<typeof listerPlansAdmin>> = [];
  for (let decalage = 0; ; decalage += 200) {
    const lot = await listerPlansAdmin(db, {}, { limite: 200, decalage });
    plans.push(...lot);
    if (lot.length < 200) break;
  }
  const actifs = plans.filter((p) => p.statut === 'ACTIF');
  return {
    actifs: actifs.length,
    soldes: plans.filter((p) => p.statut === 'SOLDE').length,
    proposes: plans.filter((p) => p.statut === 'PROPOSE').length,
    enRetard: actifs.filter((p) => p.enRetard).length,
    totalRestantFcfa: actifs.reduce((t, p) => t + p.restantFcfa, 0),
    totalEncaisseFcfa: plans.reduce((t, p) => t + p.payeFcfa, 0),
  };
}

export async function annulerPlan(db: Db, admin: AuthUser, planId: string, motif: string) {
  const p = await chargerPlan(db, planId);
  if (p.statut !== 'PROPOSE' && p.statut !== 'ACTIF') throw conflict('Seul un plan proposé ou actif peut être annulé');
  await db.transaction(async (tx) => {
    await tx.update(plansEcheloneces).set({ statut: 'ANNULE', motifAnnulation: motif }).where(eq(plansEcheloneces.id, planId));
    // Une avance en cours réservait les articles : la réservation est libérée (sans effet si rien n'était réservé).
    await libererPourCommande(tx, p.commandeId);
    if (p.statut === 'PROPOSE') await tx.update(commandes).set({ statut: 'PANIER' }).where(eq(commandes.id, p.commandeId));
    await journaliser(tx, { acteurId: admin.id, action: 'ECHELONNEMENT_ANNULE', cibleType: 'plan_echelonne', cibleId: planId, details: { motif, ancienStatut: p.statut } });
    await notifier(tx, { destinataireId: p.clientId, type: 'ECHELONNEMENT_ANNULE', titre: 'Paiement échelonné annulé', message: 'NZE a annulé ce paiement échelonné. Les sommes déjà versées restent enregistrées. Contactez NZE pour plus d’informations.', cibleType: 'plan_echelonne', cibleId: planId });
    for (const id of await partenairesDe(tx, p.entrepriseId)) {
      await notifier(tx, { destinataireId: id, type: 'ECHELONNEMENT_ANNULE', titre: 'Paiement échelonné annulé', message: 'Un paiement échelonné sur vos articles a été annulé par NZE.', cibleType: 'plan_echelonne', cibleId: planId });
    }
  });
  return { id: planId, statut: 'ANNULE' as const };
}

// ---------- Échéances et retards : notifications, jamais de pénalité ----------

async function dejaNotifie(db: Db, destinataireId: string, type: string, cibleId: string, depuis: Date): Promise<boolean> {
  const [n] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.destinataireId, destinataireId), eq(notifications.type, type), eq(notifications.cibleId, cibleId), gt(notifications.createdAt, depuis)))
    .limit(1);
  return Boolean(n);
}

// Appelée chaque jour (tâche planifiée, ou depuis l'administration). Une seule notification par type et par plan et par jour.
export async function relancerEcheances(db: Db, maintenant = new Date()) {
  await appliquerPenalites(db, maintenant);
  const parMois = await relancerEcheancesMois(db, maintenant);
  // Plans antérieurs à l'échéancier par article : l'ancien suivi par plan reste en place pour eux.
  const actifs = await db.select().from(plansEcheloneces).where(eq(plansEcheloneces.statut, 'ACTIF'));
  let proches = 0;
  let retards = 0;
  for (const p of actifs) {
    if (await aDesEcheanciers(db, p.id)) continue;
    const vs = await versementsDuPlan(db, p.id);
    const s = situationDuPlan(p, vs, maintenant);
    if (!s || s.restantFcfa === 0) continue;
    const depuis = new Date(maintenant.getTime() - JOUR_MS);
    if (s.enRetard) {
      if (!(await dejaNotifie(db, p.clientId, 'ECHEANCE_RETARD', p.id, depuis))) {
        await db.transaction(async (tx) => {
          await notifier(tx, { destinataireId: p.clientId, type: 'ECHEANCE_RETARD', titre: 'Échéance non réglée', message: `Il reste ${s.dueCetteEcheanceFcfa} FCFA à régler sur votre échéance. Aucune pénalité : réglez quand vous le pouvez depuis votre suivi.`, cibleType: 'plan_echelonne', cibleId: p.id });
        });
        retards += 1;
      }
    } else if (s.dueCetteEcheanceFcfa > 0 && s.echeances[0] && s.echeances[0].date.getTime() - maintenant.getTime() <= RELANCE_AVANT_MS) {
      if (!(await dejaNotifie(db, p.clientId, 'ECHEANCE_PROCHE', p.id, depuis))) {
        await db.transaction(async (tx) => {
          await notifier(tx, { destinataireId: p.clientId, type: 'ECHEANCE_PROCHE', titre: 'Échéance prochaine', message: `${s.dueCetteEcheanceFcfa} FCFA à régler avant le ${s.echeances[0].date.toISOString().slice(0, 10)}.`, cibleType: 'plan_echelonne', cibleId: p.id });
        });
        proches += 1;
      }
    }
  }
  return { echeancesProches: parMois.rappels + parMois.duJour + proches, echeancesEnRetard: parMois.retards + retards };
}


// Produits : possibilité de payer en échelonné (par défaut oui).
export async function definirEchelonnable(db: Db, admin: AuthUser, produitId: string, echelonnable: boolean) {
  const [p] = await db.select({ id: produits.id }).from(produits).where(eq(produits.id, produitId)).limit(1);
  if (!p) throw notFound('Produit introuvable');
  await db.transaction(async (tx) => {
    await tx.update(produits).set({ echelonnable }).where(eq(produits.id, produitId));
    await journaliser(tx, { acteurId: admin.id, action: 'PRODUIT_ECHELONNABLE', cibleType: 'produit', cibleId: produitId, details: { echelonnable } });
  });
  return { id: produitId, echelonnable };
}

export async function detailPlanAdmin(db: Db, planId: string) {
  const p = await chargerPlan(db, planId);
  const vs = await versementsDuPlan(db, planId);
  const s = situationDuPlan(p, vs, new Date());
  const [cmd] = await db.select({ reference: commandes.reference }).from(commandes).where(eq(commandes.id, p.commandeId)).limit(1);
  const [client] = await db.select({ nomAffiche: users.nomAffiche, telephone: users.telephone }).from(users).where(eq(users.id, p.clientId)).limit(1);
  return {
    ...presenterPourClient(p, vs, await articlesDeCommande(db, p.commandeId), cmd.reference),
    client: { nom: client.nomAffiche, telephone: client.telephone },
    commercantTotalFcfa: p.commercantTotalFcfa,
    commissionTotalFcfa: p.commissionTotalFcfa,
    livraisonTotalFcfa: p.livraisonTotalFcfa,
    enRetard: s?.enRetard ?? false,
    versementsDetail: vs.map((v) => ({ id: v.id, type: v.type, statut: v.statut, montantFcfa: v.montantFcfa, commercantFcfa: v.commercantFcfa, commissionFcfa: v.commissionFcfa, livraisonFcfa: v.livraisonFcfa, encaisseLe: v.encaisseLe })),
  };
}

// ---------- Échéancier par article, conditions, pénalité, paramètres d'article ----------

const CLE_PENALITE = 'echelonnement_penalite_mois';

export async function lirePenaliteEchelonnement(db: Db): Promise<number> {
  const [r] = await db.select({ valeur: reglages.valeur }).from(reglages).where(eq(reglages.cle, CLE_PENALITE)).limit(1);
  if (!r) return PENALITE_PAR_MOIS_DEFAUT_FCFA;
  const n = Number(r.valeur);
  return Number.isSafeInteger(n) ? n : PENALITE_PAR_MOIS_DEFAUT_FCFA;
}

export async function definirPenaliteEchelonnement(db: Db, admin: AuthUser, montantFcfa: number) {
  const montant = verifierBorne(montantFcfa, BORNES_PENALITE_FCFA, 'La pénalité');
  await db.transaction(async (tx) => {
    await tx
      .insert(reglages)
      .values({ cle: CLE_PENALITE, valeur: String(montant), acteurId: admin.id, misAJourLe: new Date() })
      .onConflictDoUpdate({ target: reglages.cle, set: { valeur: String(montant), acteurId: admin.id, misAJourLe: new Date() } });
    await journaliser(tx, { acteurId: admin.id, action: 'ECHELONNEMENT_PENALITE', cibleType: 'reglage', cibleId: CLE_PENALITE, details: { penaliteParMoisFcfa: montant } });
  });
  return { penaliteParMoisFcfa: montant };
}

// Échéancier de chaque article du panier, dans l'ordre des lignes. Un article sans durée est refusé.
async function calculerEcheanciers(db: Db, lignes: { id: string; produitId: string; prixUnitaireFcfa: number; quantite: number }[], parametres: ParametresEchelonnement) {
  const lus = await db
    .select({ id: produits.id, nom: produits.nom, dureeMois: produits.dureeMois, avancePourcent: produits.avancePourcent })
    .from(produits)
    .where(inArray(produits.id, lignes.map((l) => l.produitId)));
  return lignes.map((l) => {
    const p = lus.find((x) => x.id === l.produitId);
    if (!p) throw notFound('Article introuvable');
    if (p.dureeMois === null) throw conflict(`La durée d’échelonnement n’est pas renseignée pour l’article ${p.nom}`);
    const e = echeancierArticle(l.prixUnitaireFcfa * l.quantite, p.avancePourcent ?? parametres.avancePourcent, p.dureeMois);
    return { ...e, ligneId: l.id, produitId: l.produitId, nom: p.nom };
  });
}

// Conditions affichées au client avant confirmation : rien n'est enregistré.
export async function conditionsEcheancier(deps: EchelonnementDeps, user: AuthUser, commandeId: string) {
  if (!(await echelonnementActif(deps.db))) {
    throw new AppError(409, 'ECHELONNEMENT_DESACTIVE', 'Le paiement échelonné est suspendu par NZE.');
  }
  const [c0] = await deps.db.select().from(commandes).where(and(eq(commandes.id, commandeId), eq(commandes.userId, user.id))).limit(1);
  if (!c0) throw notFound('Commande introuvable');
  if (c0.statut !== 'PANIER') throw conflict('Cette commande n’est plus au panier');
  const lignes = await deps.db.select().from(lignesCommande).where(eq(lignesCommande.commandeId, commandeId));
  if (lignes.length === 0) throw badRequest('La commande est vide');
  if (lignes.length > MAX_ARTICLES_ECHELONNES) throw badRequest(`Le paiement échelonné concerne au maximum ${MAX_ARTICLES_ECHELONNES} articles`);
  const livraison = await calculerLivraison(deps, c0, lignes);
  const parametres = await lireParametresEchelonnement(deps.db);
  const articles = await calculerEcheanciers(deps.db, lignes, parametres);
  return {
    totalFcfa: c0.sousTotalFcfa + livraison.frais,
    livraisonFcfa: livraison.frais,
    avanceFcfa: articles.reduce((t, a) => t + a.avanceFcfa, 0) + livraison.frais,
    resteFcfa: articles.reduce((t, a) => t + a.resteFcfa, 0),
    mensualiteFcfa: articles.reduce((t, a) => t + a.mensualiteFcfa, 0),
    penaliteParMoisFcfa: await lirePenaliteEchelonnement(deps.db),
    regle: 'Les dates limites tombent le même jour de chaque mois, à partir de la validation de l’avance.',
    articles,
  };
}

// Durée (mois) et avance (%) d'un article, réglées par l'administration. Un article échelonnable a toujours une durée.
export async function definirParametresArticle(
  db: Db,
  admin: AuthUser,
  produitId: string,
  saisie: { echelonnable?: boolean; dureeMois?: number | null; avancePourcent?: number | null },
) {
  const [p] = await db
    .select({ id: produits.id, echelonnable: produits.echelonnable, dureeMois: produits.dureeMois, avancePourcent: produits.avancePourcent })
    .from(produits).where(eq(produits.id, produitId)).limit(1);
  if (!p) throw notFound('Produit introuvable');
  const duree = saisie.dureeMois === undefined ? p.dureeMois : saisie.dureeMois;
  const pourcent = saisie.avancePourcent === undefined ? p.avancePourcent : saisie.avancePourcent;
  const echelonnable = saisie.echelonnable ?? p.echelonnable;
  if (duree !== null) verifierBorne(duree, BORNES.dureeMaxMois, 'La durée');
  if (pourcent !== null) verifierBorne(pourcent, BORNES.avancePourcent, 'L’avance');
  if (echelonnable && duree === null) throw badRequest('La durée en mois est requise pour un article échelonnable');
  await db.transaction(async (tx) => {
    await tx.update(produits).set({ echelonnable, dureeMois: duree, avancePourcent: pourcent }).where(eq(produits.id, produitId));
    await journaliser(tx, { acteurId: admin.id, action: 'PRODUIT_ECHELONNABLE', cibleType: 'produit', cibleId: produitId, details: { echelonnable, dureeMois: duree, avancePourcent: pourcent } });
  });
  return { id: produitId, echelonnable, dureeMois: duree, avancePourcent: pourcent };
}
