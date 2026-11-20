import type { Page } from '../../core/pagination.ts';
// Retraits des commerçants.
// Solde = ventes nettes − montants en cours de versement − montants versés. Une demande en attente bloque son montant.
// Acceptation : le versement partenaire part via MyPVit (GIVE_CHANGE). Échec : le montant est rendu.
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import { bordereaux, demandesRetrait, ecritures, entreprises, lignesBordereau, litigesPartenaire, reclamations } from '../../db/schema.ts';
import { badRequest, conflict, forbidden, notFound } from '../../core/errors.ts';
import { log } from '../../core/logger.ts';
import type { AuthUser } from '../../core/auth.ts';
import type { MyPvitClient } from '../paiements/providers/mypvit/index.ts';
import { journaliser } from '../audit/service.ts';
import { notifier } from '../notifications/service.ts';
import { verdictVersement } from './verdict-versement.ts';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export interface RetraitDeps { db: Db; mypvit: MyPvitClient }

async function montantsParStatut(exec: Db, entrepriseId: string) {
  const lignes = await exec
    .select({ statut: demandesRetrait.statut, total: sql<number>`coalesce(sum(${demandesRetrait.montantFcfa}), 0)::int` })
    .from(demandesRetrait)
    .where(eq(demandesRetrait.entrepriseId, entrepriseId))
    .groupBy(demandesRetrait.statut);
  const somme = (...statuts: string[]) => lignes.filter((l) => statuts.includes(l.statut)).reduce((t, l) => t + l.total, 0);
  return { enAttente: somme('EN_ATTENTE'), enCours: somme('VERSEMENT_EN_COURS'), verse: somme('VERSEE') };
}

// Fonds réservés (cahier §15.5) : une vente n'est retirable qu'une fois la collecte de sa ligne validée
// (bordereau VALIDE, ligne CONFORME), et seulement si la ligne n'a ni réclamation ouverte ni litige ouvert.
async function lignesRetirables(exec: Db, entrepriseId: string): Promise<string[]> {
  // Litige ouvert sans réclamation liée : il ne vise aucune ligne précise, donc il bloque tout le solde du partenaire.
  const litigeGlobal = await exec
    .select({ id: litigesPartenaire.id })
    .from(litigesPartenaire)
    .where(and(eq(litigesPartenaire.entrepriseId, entrepriseId), eq(litigesPartenaire.statut, 'OUVERT'), isNull(litigesPartenaire.reclamationId)))
    .limit(1);
  if (litigeGlobal.length > 0) return [];
  const collectees = await exec
    .select({ ligneId: lignesBordereau.ligneCommandeId })
    .from(lignesBordereau)
    .innerJoin(bordereaux, eq(bordereaux.id, lignesBordereau.bordereauId))
    .where(and(eq(bordereaux.entrepriseId, entrepriseId), eq(bordereaux.statut, 'VALIDE'), eq(lignesBordereau.controle, 'CONFORME')));
  const reclamationsOuvertes = await exec
    .select({ ligneId: reclamations.ligneCommandeId })
    .from(reclamations)
    .where(inArray(reclamations.statut, ['OUVERTE', 'ACCEPTEE']));
  const litigesOuverts = await exec
    .select({ ligneId: reclamations.ligneCommandeId })
    .from(litigesPartenaire)
    .innerJoin(reclamations, eq(reclamations.id, litigesPartenaire.reclamationId))
    .where(eq(litigesPartenaire.statut, 'OUVERT'));
  const bloquees = new Set<string>([...reclamationsOuvertes, ...litigesOuverts].map((r) => r.ligneId));
  const uniques = new Set(collectees.map((c) => c.ligneId).filter((id): id is string => !!id));
  return [...uniques].filter((id) => !bloquees.has(id));
}

async function totalVentesNettes(exec: Db, entrepriseId: string, lignes?: string[]): Promise<number> {
  if (lignes && lignes.length === 0) return 0;
  const [v] = await exec
    .select({ total: sql<number>`coalesce(sum(${ecritures.montantFcfa}), 0)::int` })
    .from(ecritures)
    .where(and(eq(ecritures.entrepriseId, entrepriseId), eq(ecritures.categorie, 'VENTE_NET'), lignes ? inArray(ecritures.ligneId, lignes) : undefined));
  return v.total;
}

async function ventesNettes(exec: Db, entrepriseId: string): Promise<number> {
  return totalVentesNettes(exec, entrepriseId, await lignesRetirables(exec, entrepriseId));
}

export async function soldeEntreprise(db: Db, entrepriseId: string) {
  const ventes = await ventesNettes(db, entrepriseId);
  const totales = await totalVentesNettes(db, entrepriseId);
  const m = await montantsParStatut(db, entrepriseId);
  const solde = ventes - m.enCours - m.verse;
  return { solde, enAttente: m.enAttente, disponible: solde - m.enAttente, enAttenteCollecte: totales - ventes };
}

// Retrait par carte (Visa, Mastercard) : désactivé tant que MyPVit n'a pas confirmé par écrit ses versements vers carte.
// Ne passer à true qu'après cette confirmation et le branchement du versement carte.
export const RETRAIT_CARTE_DISPONIBLE = false;

export async function demanderRetrait(db: Db, user: AuthUser, b: { montantFcfa: number; operateur: string; numero?: string; nomBeneficiaire: string }) {
  if (!user.entrepriseId) throw forbidden();
  if (!Number.isSafeInteger(b.montantFcfa) || b.montantFcfa <= 0) throw badRequest('Montant invalide');
  if (b.operateur === 'CARTE' && !RETRAIT_CARTE_DISPONIBLE) throw conflict('Le retrait par carte n’est pas encore disponible');
  const entrepriseId = user.entrepriseId;
  return db.transaction(async (tx: Tx) => {
    // Verrou sur l'entreprise : deux demandes simultanées ne peuvent pas dépasser le solde.
    await tx.select({ id: entreprises.id }).from(entreprises).where(eq(entreprises.id, entrepriseId)).for('update');
    const ventes = await ventesNettes(tx as unknown as Db, entrepriseId);
    const m = await montantsParStatut(tx as unknown as Db, entrepriseId);
    const disponible = ventes - m.enAttente - m.enCours - m.verse;
    if (b.montantFcfa > disponible) throw conflict(`Montant supérieur au solde disponible (${disponible} FCFA)`);
    const [d] = await tx
      .insert(demandesRetrait)
      .values({ entrepriseId, demandeurId: user.id, montantFcfa: b.montantFcfa, operateur: b.operateur, numero: b.numero ?? null, nomBeneficiaire: b.nomBeneficiaire })
      .returning();
    return d;
  });
}

function referenceVersement(id: string): string {
  return `RET-${id.replace(/-/g, '').slice(0, 12)}-${Date.now().toString(36)}`;
}

export async function decider(deps: RetraitDeps, id: string, decision: 'ACCEPTER' | 'REJETER', adminId: string) {
  if (decision === 'REJETER') {
    return deps.db.transaction(async (tx: Tx) => {
      const [d] = await tx.select().from(demandesRetrait).where(eq(demandesRetrait.id, id)).for('update');
      if (!d) throw notFound('Demande introuvable');
      if (d.statut !== 'EN_ATTENTE') throw conflict('Cette demande a déjà été traitée');
      const [maj] = await tx.update(demandesRetrait).set({ statut: 'REJETEE', decidePar: adminId, decideLe: new Date() }).where(eq(demandesRetrait.id, id)).returning();
      await journaliser(tx, { acteurId: adminId, action: 'RETRAIT_DECIDE', cibleType: 'demande_retrait', cibleId: id, details: { decision } });
      await notifier(tx, { destinataireId: d.demandeurId, type: 'RETRAIT_REJETE', titre: 'Demande de retrait refusée', message: 'Votre demande de retrait n’a pas été acceptée. Contactez NZE pour plus d’informations.', cibleType: 'demande_retrait', cibleId: id });
      return maj;
    });
  }

  // Acceptation : la demande passe en versement, puis le versement part via MyPVit.
  const reference = referenceVersement(id);
  const enCours = await deps.db.transaction(async (tx: Tx) => {
    const [d] = await tx.select().from(demandesRetrait).where(eq(demandesRetrait.id, id)).for('update');
    if (!d) throw notFound('Demande introuvable');
    if (d.statut !== 'EN_ATTENTE') throw conflict('Cette demande a déjà été traitée');
    if (decision === 'ACCEPTER' && d.operateur === 'CARTE' && !RETRAIT_CARTE_DISPONIBLE) {
      throw conflict('Le versement par carte n’est pas encore confirmé par MyPVit');
    }
    const [maj] = await tx
      .update(demandesRetrait)
      .set({ statut: 'VERSEMENT_EN_COURS', referenceMarchand: reference, decidePar: adminId, decideLe: new Date() })
      .where(eq(demandesRetrait.id, id))
      .returning();
    await journaliser(tx, { acteurId: adminId, action: 'RETRAIT_DECIDE', cibleType: 'demande_retrait', cibleId: id, details: { decision } });
    await notifier(tx, { destinataireId: d.demandeurId, type: 'RETRAIT_EN_COURS', titre: 'Retrait en cours de versement', message: 'Votre demande de retrait est acceptée. Le versement est en cours.', cibleType: 'demande_retrait', cibleId: id });
    return maj;
  });

  try {
    const r = await deps.mypvit.initiatePartnerWithdrawal({
      reference,
      amount: enCours.montantFcfa,
      operatorCode: enCours.operateur,
      customerMsisdn: enCours.numero ?? '', // renseigné pour Airtel et Moov ; la carte est bloquée plus haut
      freeInfo: enCours.nomBeneficiaire,
    });
    const statut = r.nzeStatus === 'FAILED' ? 'ECHEC' : 'VERSEMENT_EN_COURS';
    const [maj] = await deps.db
      .update(demandesRetrait)
      .set({ referenceFournisseur: r.referenceId, statut, dernierControle: new Date() })
      .where(eq(demandesRetrait.id, id))
      .returning();
    return maj;
  } catch {
    // Résultat inconnu : le versement reste en cours et sera vérifié.
    log('error', 'versement_initiation_incertaine', { demande: id });
    return enCours;
  }
}

// Vérifie auprès de MyPVit un versement en cours.
// acteurId : l'administrateur qui vérifie, ou null quand c'est le callback de PVit (événement système).
export async function verifierVersement(deps: RetraitDeps, id: string, acteurId: string | null): Promise<string> {
  const [d] = await deps.db.select().from(demandesRetrait).where(eq(demandesRetrait.id, id)).limit(1);
  if (!d) throw notFound('Demande introuvable');
  if (d.statut !== 'VERSEMENT_EN_COURS') throw conflict('Ce retrait n’est pas en cours de versement');
  const identifiant = d.referenceFournisseur ?? d.referenceMarchand;
  if (!identifiant) throw conflict('Référence de versement absente');
  const r = await deps.mypvit.getTransactionStatus(identifiant, 'GIVE_CHANGE', d.operateur);
  if (r.amount !== null && r.amount !== d.montantFcfa) log('error', 'versement_montant_incoherent', { demande: id });
  const verdict = verdictVersement(r, d.montantFcfa);
  let statut = verdict ?? (d.statut as string);
  // Changement d'état, trace et message au commerçant : tout ou rien.
  await deps.db.transaction(async (tx: Tx) => {
    await tx.update(demandesRetrait).set({ statut, dernierControle: new Date() }).where(eq(demandesRetrait.id, id));
    await journaliser(tx, { acteurId, action: 'VERSEMENT_VERIFIE', cibleType: 'demande_retrait', cibleId: id, details: { statut } });
    if (statut !== d.statut && statut === 'VERSEE') {
      await notifier(tx, { destinataireId: d.demandeurId, type: 'RETRAIT_VERSE', titre: 'Retrait versé', message: 'Votre retrait a été versé sur votre compte Mobile Money.', cibleType: 'demande_retrait', cibleId: id });
    }
    if (statut !== d.statut && statut === 'ECHEC') {
      await notifier(tx, { destinataireId: d.demandeurId, type: 'RETRAIT_ECHEC', titre: 'Retrait non abouti', message: 'Le versement de votre retrait n’a pas abouti. Le montant est rendu à votre solde. Contactez NZE.', cibleType: 'demande_retrait', cibleId: id });
    }
  });
  return statut;
}

// Résolution manuelle d'un versement dont l'issue n'a pas pu être confirmée (envoi incertain).
// L'administrateur vérifie chez MyPVit, puis tranche avec un motif. Rien n'est décidé automatiquement.
export async function resoudreVersement(deps: RetraitDeps, id: string, issue: 'VERSEE' | 'ECHEC', motif: string, adminId: string): Promise<string> {
  if (issue !== 'VERSEE' && issue !== 'ECHEC') throw badRequest('Issue invalide');
  if (motif.trim().length < 5) throw badRequest('Motif obligatoire (5 caractères minimum)');
  return deps.db.transaction(async (tx: Tx) => {
    const [d] = await tx.select().from(demandesRetrait).where(eq(demandesRetrait.id, id)).for('update');
    if (!d) throw notFound('Demande introuvable');
    if (d.statut !== 'VERSEMENT_EN_COURS') throw conflict('Ce retrait n’est pas en cours de versement');
    await tx.update(demandesRetrait).set({ statut: issue, decidePar: adminId, decideLe: new Date(), dernierControle: new Date() }).where(eq(demandesRetrait.id, id));
    await journaliser(tx, { acteurId: adminId, action: 'VERSEMENT_RESOLU', cibleType: 'demande_retrait', cibleId: id, details: { issue, motif: motif.trim() } });
    if (issue === 'VERSEE') {
      await notifier(tx, { destinataireId: d.demandeurId, type: 'RETRAIT_VERSE', titre: 'Retrait versé', message: 'Votre retrait a été versé sur votre compte Mobile Money.', cibleType: 'demande_retrait', cibleId: id });
    } else {
      await notifier(tx, { destinataireId: d.demandeurId, type: 'RETRAIT_ECHEC', titre: 'Retrait non abouti', message: 'Le versement de votre retrait n’a pas abouti. Le montant est rendu à votre solde. Contactez NZE.', cibleType: 'demande_retrait', cibleId: id });
    }
    return issue;
  });
}

export async function listerRetraitsEntreprise(db: Db, entrepriseId: string, page: Page) {
  return db
    .select()
    .from(demandesRetrait)
    .where(eq(demandesRetrait.entrepriseId, entrepriseId))
    .orderBy(desc(demandesRetrait.createdAt), desc(demandesRetrait.id))
    .limit(page.limite)
    .offset(page.decalage);
}

export async function listerRetraitsAdmin(db: Db, statut: string | undefined, page: Page) {
  const q = db
    .select({
      id: demandesRetrait.id, entrepriseId: demandesRetrait.entrepriseId, entrepriseNom: entreprises.nom,
      montantFcfa: demandesRetrait.montantFcfa, operateur: demandesRetrait.operateur, numero: demandesRetrait.numero,
      nomBeneficiaire: demandesRetrait.nomBeneficiaire, statut: demandesRetrait.statut, createdAt: demandesRetrait.createdAt,
    })
    .from(demandesRetrait)
    .innerJoin(entreprises, eq(entreprises.id, demandesRetrait.entrepriseId));
  return (statut ? q.where(eq(demandesRetrait.statut, statut)) : q)
    .orderBy(desc(demandesRetrait.createdAt), desc(demandesRetrait.id))
    .limit(page.limite)
    .offset(page.decalage);
}
