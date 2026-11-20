// Échéances mensuelles par article : ouverture à l'avance, affectation des versements, recalcul du reste, pénalités.
// Ordre d'affectation d'un versement : d'abord le mois le plus ancien non soldé, puis les pénalités dues.
// Les pénalités reviennent à NZE : elles ne rentrent jamais dans la part du commerçant.
import { and, asc, eq, inArray, isNotNull } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import { affectationsVersement, commandes, echeanciersArticles, echeancesMois, penalitesEcheancier, plansEcheloneces, produits, reglages, versementsEcheloneces } from '../../db/schema.ts';
import { badRequest, notFound } from '../../core/errors.ts';
import { notifier } from '../notifications/service.ts';
import { notifications } from '../../db/schema.ts';
import { ajouterMois, PENALITE_PAR_MOIS_DEFAUT_FCFA } from './regles.ts';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type Executeur = Db | Tx;

const CLE_PENALITE = 'echelonnement_penalite_mois';

export async function penaliteParMois(db: Executeur): Promise<number> {
  const [r] = await db.select({ valeur: reglages.valeur }).from(reglages).where(eq(reglages.cle, CLE_PENALITE)).limit(1);
  if (!r) return PENALITE_PAR_MOIS_DEFAUT_FCFA;
  const n = Number(r.valeur);
  return Number.isSafeInteger(n) ? n : PENALITE_PAR_MOIS_DEFAUT_FCFA;
}

// Ouvre les échéances à la validation de l'avance : le mois 1 tombe le même jour du mois suivant, et ainsi de suite.
export async function ouvrirEcheances(tx: Tx, planId: string, debut: Date): Promise<void> {
  const eches = await tx.select().from(echeanciersArticles).where(eq(echeanciersArticles.planId, planId));
  for (const e of eches) {
    const lignes = Array.from({ length: e.dureeMois }, (_, i) => ({
      echeancierId: e.id,
      numero: i + 1,
      montantDuFcfa: i + 1 < e.dureeMois ? e.mensualiteFcfa : e.dernierMoisFcfa,
      montantPayeFcfa: 0,
      dateLimite: ajouterMois(debut, i + 1),
    }));
    await tx.insert(echeancesMois).values(lignes);
  }
}

export async function soldeArticle(db: Executeur, echeancierId: string) {
  const mois = await db.select().from(echeancesMois).where(eq(echeancesMois.echeancierId, echeancierId));
  const pen = await db.select().from(penalitesEcheancier).where(eq(penalitesEcheancier.echeancierId, echeancierId));
  const principal = mois.reduce((t, m) => t + Math.max(0, m.montantDuFcfa - m.montantPayeFcfa), 0);
  const penalites = pen.reduce((t, p) => t + Math.max(0, p.montantFcfa - p.montantPayeFcfa), 0);
  return { principal, penalites, total: principal + penalites };
}

// Pénalités déjà encaissées sur un plan : elles sont exclues du cumul de l'achat.
export async function penalitesPayeesPlan(db: Executeur, planId: string): Promise<number> {
  const rows = await db
    .select({ montant: affectationsVersement.montantFcfa })
    .from(affectationsVersement)
    .innerJoin(versementsEcheloneces, eq(versementsEcheloneces.id, affectationsVersement.versementId))
    .where(and(eq(versementsEcheloneces.planId, planId), isNotNull(affectationsVersement.penaliteId)));
  return rows.reduce((t, r) => t + r.montant, 0);
}

// Article visé par un versement : celui que le client choisit. Un plan à article unique n'a pas besoin de choix.
export async function resoudreArticle(db: Executeur, planId: string, saisi?: string): Promise<string | null> {
  const eches = await db.select({ id: echeanciersArticles.id }).from(echeanciersArticles).where(eq(echeanciersArticles.planId, planId));
  if (eches.length === 0) return null; // plan antérieur à l'échéancier par article
  if (saisi) {
    if (!eches.some((e) => e.id === saisi)) throw badRequest('Cet article ne fait pas partie de ce paiement échelonné');
    return saisi;
  }
  if (eches.length === 1) return eches[0].id;
  throw badRequest('Précisez l’article à régler');
}

// Recalcul du reste (option a) : le reste de l'achat est réparti sur les mois non soldés, la durée est conservée.
async function repartirReste(tx: Tx, echeancierId: string): Promise<void> {
  const [e] = await tx.select().from(echeanciersArticles).where(eq(echeanciersArticles.id, echeancierId)).limit(1);
  const mois = await tx.select().from(echeancesMois).where(eq(echeancesMois.echeancierId, echeancierId)).orderBy(asc(echeancesMois.numero));
  const paye = mois.reduce((t, m) => t + m.montantPayeFcfa, 0);
  const reste = Math.max(0, e.resteFcfa - paye);
  const enCours = mois.filter((m) => m.montantPayeFcfa < m.montantDuFcfa);
  const n = enCours.length;
  if (n === 0) return;
  let parts: number[];
  const base = Math.ceil(reste / n);
  if (reste - base * (n - 1) >= 0) {
    parts = Array.from({ length: n }, (_, i) => (i < n - 1 ? base : reste - base * (n - 1)));
  } else {
    // Reste inférieur au nombre de mois : les premiers mois reçoivent 1 FCFA, les autres soldent sans montant restant.
    parts = Array.from({ length: n }, (_, i) => (i < reste ? 1 : 0));
  }
  for (let i = 0; i < n; i++) {
    const m = enCours[i];
    await tx.update(echeancesMois).set({ montantDuFcfa: m.montantPayeFcfa + parts[i] }).where(eq(echeancesMois.id, m.id));
  }
}

// Affecte un versement encaissé à l'article : mois les plus anciens d'abord, puis pénalités dues.
// Renvoie le montant versé en pénalités (pour le faire revenir à NZE).
export async function affecterVersement(tx: Tx, versementId: string, echeancierId: string, montant: number): Promise<number> {
  let reste = montant;
  const mois = await tx.select().from(echeancesMois).where(eq(echeancesMois.echeancierId, echeancierId)).orderBy(asc(echeancesMois.numero));
  for (const m of mois) {
    const a = Math.min(reste, m.montantDuFcfa - m.montantPayeFcfa);
    if (reste <= 0) break;
    if (a <= 0) continue;
    await tx.update(echeancesMois).set({ montantPayeFcfa: m.montantPayeFcfa + a }).where(eq(echeancesMois.id, m.id));
    await tx.insert(affectationsVersement).values({ versementId, echeanceId: m.id, penaliteId: null, montantFcfa: a });
    reste -= a;
  }
  let penalitesPayees = 0;
  const pens = await tx.select().from(penalitesEcheancier).where(eq(penalitesEcheancier.echeancierId, echeancierId)).orderBy(asc(penalitesEcheancier.moisRetard));
  for (const p of pens) {
    const a = Math.min(reste, p.montantFcfa - p.montantPayeFcfa);
    if (reste <= 0) break;
    if (a <= 0) continue;
    await tx.update(penalitesEcheancier).set({ montantPayeFcfa: p.montantPayeFcfa + a }).where(eq(penalitesEcheancier.id, p.id));
    await tx.insert(affectationsVersement).values({ versementId, echeanceId: null, penaliteId: p.id, montantFcfa: a });
    reste -= a;
    penalitesPayees += a;
  }
  if (reste > 0) {
    // Trop-perçu après soldes de tous les mois et pénalités : porté sur le dernier mois, et tracé.
    const [dernier] = await tx.select().from(echeancesMois).where(eq(echeancesMois.echeancierId, echeancierId)).orderBy(asc(echeancesMois.numero)).then((r) => r.slice(-1));
    await tx.update(echeancesMois).set({ montantPayeFcfa: dernier.montantPayeFcfa + reste }).where(eq(echeancesMois.id, dernier.id));
    await tx.insert(affectationsVersement).values({ versementId, echeanceId: dernier.id, penaliteId: null, montantFcfa: reste });
  }
  await repartirReste(tx, echeancierId);
  return penalitesPayees;
}

// Pénalités : une par mois complet écoulé après la dernière date limite, tant qu'un solde du principal reste dû.
export async function appliquerPenalites(db: Executeur, maintenant: Date): Promise<void> {
  const eches = await db.select().from(echeanciersArticles);
  const montant = await penaliteParMois(db);
  for (const e of eches) {
    const mois = await db.select().from(echeancesMois).where(eq(echeancesMois.echeancierId, e.id)).orderBy(asc(echeancesMois.numero));
    if (mois.length === 0) continue;
    const derniere = mois[mois.length - 1].dateLimite;
    const soldeDu = mois.some((m) => m.montantPayeFcfa < m.montantDuFcfa);
    if (!soldeDu || maintenant <= derniere) continue;
    let nb = 0;
    while (ajouterMois(derniere, nb + 1) <= maintenant) nb++;
    const existantes = await db.select({ moisRetard: penalitesEcheancier.moisRetard }).from(penalitesEcheancier).where(eq(penalitesEcheancier.echeancierId, e.id));
    const deja = new Set(existantes.map((x) => x.moisRetard));
    const nouvelles = [];
    for (let k = 1; k <= nb; k++) {
      if (!deja.has(k)) nouvelles.push({ echeancierId: e.id, moisRetard: k, montantFcfa: montant, montantPayeFcfa: 0, appliqueeLe: maintenant });
    }
    if (nouvelles.length > 0) {
      const [pl] = await db.select({ clientId: plansEcheloneces.clientId }).from(plansEcheloneces).where(eq(plansEcheloneces.id, e.planId)).limit(1);
      const [pr] = await db.select({ nom: produits.nom }).from(produits).where(eq(produits.id, e.produitId)).limit(1);
      const inseres = await db.insert(penalitesEcheancier).values(nouvelles).returning();
      for (const x of inseres) {
        await notifier(db, {
          destinataireId: pl.clientId, type: 'PENALITE_APPLIQUEE',
          titre: 'Pénalité de retard', message: `Une pénalité de ${x.montantFcfa} FCFA a été ajoutée à votre échéancier de ${pr.nom}.`,
          parametres: { penalite: x.montantFcfa, produit: pr.nom, mois: x.moisRetard },
          cibleType: 'penalite', cibleId: x.id,
        });
      }
    }
  }
}

export type StatutMois = 'VALIDE' | 'PARTIEL' | 'EN_RETARD' | 'A_VENIR';

// Un mois est validé quand il est entièrement versé ; partiel si un versement est inférieur ; en retard si la date limite
// est dépassée sans solde.
export function statutMois(m: { montantDuFcfa: number; montantPayeFcfa: number; dateLimite: Date }, maintenant: Date): StatutMois {
  if (m.montantPayeFcfa >= m.montantDuFcfa) return 'VALIDE';
  if (maintenant > m.dateLimite) return 'EN_RETARD';
  if (m.montantPayeFcfa > 0) return 'PARTIEL';
  return 'A_VENIR';
}

// Vue du client : échéancier de chaque article, mois par mois, avec les pénalités.
export async function detailEcheanciers(db: Db, user: { id: string }, planId: string, maintenant = new Date()) {
  const [p] = await db.select({ id: plansEcheloneces.id, statut: plansEcheloneces.statut, clientId: plansEcheloneces.clientId })
    .from(plansEcheloneces).where(eq(plansEcheloneces.id, planId)).limit(1);
  if (!p || p.clientId !== user.id) throw notFound('Paiement échelonné introuvable');
  const eches = await db
    .select({ e: echeanciersArticles, nom: produits.nom })
    .from(echeanciersArticles)
    .innerJoin(produits, eq(produits.id, echeanciersArticles.produitId))
    .where(eq(echeanciersArticles.planId, planId));
  const ids = eches.map((x) => x.e.id);
  const mois = ids.length > 0 ? await db.select().from(echeancesMois).where(inArray(echeancesMois.echeancierId, ids)).orderBy(asc(echeancesMois.numero)) : [];
  const pens = ids.length > 0 ? await db.select().from(penalitesEcheancier).where(inArray(penalitesEcheancier.echeancierId, ids)).orderBy(asc(penalitesEcheancier.moisRetard)) : [];
  return {
    statut: p.statut,
    articles: eches.map(({ e, nom }) => {
      const mensuels = mois.filter((m) => m.echeancierId === e.id);
      const penalites = pens.filter((x) => x.echeancierId === e.id);
      return {
        echeancierId: e.id,
        nom,
        prixFcfa: e.prixFcfa,
        avanceFcfa: e.avanceFcfa,
        resteFcfa: e.resteFcfa,
        dureeMois: e.dureeMois,
        principalRestantFcfa: mensuels.reduce((t, m) => t + Math.max(0, m.montantDuFcfa - m.montantPayeFcfa), 0),
        penalitesRestantesFcfa: penalites.reduce((t, x) => t + Math.max(0, x.montantFcfa - x.montantPayeFcfa), 0),
        mois: mensuels.map((m) => ({
          numero: m.numero,
          montantDuFcfa: m.montantDuFcfa,
          montantPayeFcfa: m.montantPayeFcfa,
          resteDuFcfa: Math.max(0, m.montantDuFcfa - m.montantPayeFcfa),
          dateLimite: m.dateLimite,
          statut: statutMois(m, maintenant),
        })),
        penalites: penalites.map((x) => ({ moisRetard: x.moisRetard, montantFcfa: x.montantFcfa, montantPayeFcfa: x.montantPayeFcfa, resteFcfa: Math.max(0, x.montantFcfa - x.montantPayeFcfa) })),
      };
    }),
  };
}

// Pénalités encore dues sur un plan : tant qu'il en reste, le plan n'est pas soldé.
export async function penalitesRestantesPlan(db: Executeur, planId: string): Promise<number> {
  const rows = await db
    .select({ montant: penalitesEcheancier.montantFcfa, paye: penalitesEcheancier.montantPayeFcfa })
    .from(penalitesEcheancier)
    .innerJoin(echeanciersArticles, eq(echeanciersArticles.id, penalitesEcheancier.echeancierId))
    .where(eq(echeanciersArticles.planId, planId));
  return rows.reduce((t, r) => t + Math.max(0, r.montant - r.paye), 0);
}

export async function aDesEcheanciers(db: Executeur, planId: string): Promise<boolean> {
  const [r] = await db.select({ id: echeanciersArticles.id }).from(echeanciersArticles).where(eq(echeanciersArticles.planId, planId)).limit(1);
  return Boolean(r);
}

const JOUR_MS = 24 * 3600 * 1000;

// Jours calendaires entre aujourd'hui et la date limite (négatif = dépassée).
function joursAvant(limite: Date, maintenant: Date): number {
  const a = Date.UTC(limite.getUTCFullYear(), limite.getUTCMonth(), limite.getUTCDate());
  const b = Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate());
  return Math.round((a - b) / JOUR_MS);
}

async function dejaNotifieMois(db: Executeur, destinataireId: string, type: string, cibleId: string): Promise<boolean> {
  const [n] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.destinataireId, destinataireId), eq(notifications.type, type), eq(notifications.cibleId, cibleId)))
    .limit(1);
  return Boolean(n);
}

// Rappels par mois : trois jours avant, le jour même, puis le lendemain si le mois n'est pas soldé. Une fois par mois et par type.
export async function relancerEcheancesMois(db: Db, maintenant: Date): Promise<{ rappels: number; duJour: number; retards: number }> {
  const lignes = await db
    .select({ m: echeancesMois, produit: produits.nom, clientId: plansEcheloneces.clientId })
    .from(echeancesMois)
    .innerJoin(echeanciersArticles, eq(echeanciersArticles.id, echeancesMois.echeancierId))
    .innerJoin(plansEcheloneces, eq(plansEcheloneces.id, echeanciersArticles.planId))
    .innerJoin(produits, eq(produits.id, echeanciersArticles.produitId))
    .where(eq(plansEcheloneces.statut, 'ACTIF'));
  const compte = { rappels: 0, duJour: 0, retards: 0 };
  for (const l of lignes) {
    const m = l.m;
    const reste = m.montantDuFcfa - m.montantPayeFcfa;
    if (reste <= 0) continue;
    const jours = joursAvant(m.dateLimite, maintenant);
    let type: 'ECHEANCE_RAPPEL' | 'ECHEANCE_DU_JOUR' | 'ECHEANCE_RETARD' | null = null;
    if (jours < 0) type = 'ECHEANCE_RETARD';
    else if (jours === 0) type = 'ECHEANCE_DU_JOUR';
    else if (jours <= 3) type = 'ECHEANCE_RAPPEL';
    if (!type) continue;
    if (await dejaNotifieMois(db, l.clientId, type, m.id)) continue;
    await notifier(db, {
      destinataireId: l.clientId, type,
      titre: type === 'ECHEANCE_RETARD' ? 'Échéance non soldée' : type === 'ECHEANCE_DU_JOUR' ? 'Échéance aujourd’hui' : 'Échéance prochaine',
      message: `${l.produit} : mois ${m.numero}, ${reste} FCFA à régler.`,
      parametres: { produit: l.produit, mois: m.numero, montant: reste, date: m.dateLimite.toISOString().slice(0, 10) },
      cibleType: 'echeance_mois', cibleId: m.id,
    });
    if (type === 'ECHEANCE_RETARD') compte.retards += 1;
    else if (type === 'ECHEANCE_DU_JOUR') compte.duJour += 1;
    else compte.rappels += 1;
  }
  return compte;
}

// Détail par article pour le commerçant, à l'intérieur de sa vue par plan : mois validés, partiels, en retard et reste
// du principal. Aucune identité de client, aucune pénalité (elles reviennent à NZE).
export async function echeancesPourCommercant(db: Db, planId: string, maintenant = new Date()) {
  const eches = await db
    .select({ e: echeanciersArticles, nom: produits.nom })
    .from(echeanciersArticles)
    .innerJoin(produits, eq(produits.id, echeanciersArticles.produitId))
    .where(eq(echeanciersArticles.planId, planId));
  if (eches.length === 0) return [];
  const mois = await db
    .select()
    .from(echeancesMois)
    .where(inArray(echeancesMois.echeancierId, eches.map((x) => x.e.id)))
    .orderBy(asc(echeancesMois.numero));
  return eches.map(({ e: a, nom }) => {
    const mensuels = mois.filter((m) => m.echeancierId === a.id);
    const statuts = mensuels.map((m) => statutMois(m, maintenant));
    return {
      echeancierId: a.id,
      nom,
      prixFcfa: a.prixFcfa,
      dureeMois: a.dureeMois,
      principalRestantFcfa: mensuels.reduce((t, m) => t + Math.max(0, m.montantDuFcfa - m.montantPayeFcfa), 0),
      moisValides: statuts.filter((s) => s === 'VALIDE').length,
      moisPartiels: statuts.filter((s) => s === 'PARTIEL').length,
      moisEnRetard: statuts.filter((s) => s === 'EN_RETARD').length,
    };
  });
}

// Alertes d'un plan, calculées article par article : montant de l'échéance en cours (premier mois non soldé de chaque
// article) et présence d'un mois en retard. Null pour un plan antérieur à l'échéancier par article.
export async function alertesPlan(db: Executeur, planId: string, maintenant = new Date()): Promise<{ dueCetteEcheanceFcfa: number; enRetard: boolean } | null> {
  const eches = await db.select({ id: echeanciersArticles.id }).from(echeanciersArticles).where(eq(echeanciersArticles.planId, planId));
  if (eches.length === 0) return null;
  const mois = await db
    .select()
    .from(echeancesMois)
    .where(inArray(echeancesMois.echeancierId, eches.map((x) => x.id)))
    .orderBy(asc(echeancesMois.numero));
  let due = 0;
  let enRetard = false;
  for (const a of eches) {
    const mensuels = mois.filter((m) => m.echeancierId === a.id);
    const enCours = mensuels.find((m) => m.montantPayeFcfa < m.montantDuFcfa);
    if (enCours) due += enCours.montantDuFcfa - enCours.montantPayeFcfa;
    if (mensuels.some((m) => statutMois(m, maintenant) === 'EN_RETARD')) enRetard = true;
  }
  return { dueCetteEcheanceFcfa: due, enRetard };
}
