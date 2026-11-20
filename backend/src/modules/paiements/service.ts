// Paiements : en ligne (Airtel Money, Moov Money, carte via MyPVit) ou sur place (option de confiance).
// Un paiement n'est confirmé que par le statut vérifié. Le stock est réservé au lancement du paiement,
// vendu à la confirmation, libéré en cas d'échec.
import { and, eq, inArray, lt, or } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import { commandes, demandesRetrait, lignesCommande, transactions } from '../../db/schema.ts';
import { verifierVersement } from '../finance/retraits.ts';
import { conflict, notFound } from '../../core/errors.ts';
import { log } from '../../core/logger.ts';
import type { AuthUser } from '../../core/auth.ts';
import type { MyPvitClient, NzeStatus } from './providers/mypvit/index.ts';
import { marquerEchec, marquerPayee } from '../commandes/service.ts';
import { reserverPourCommande, verifierDisponibilite } from '../stock/service.ts';
import { calculerLivraison, figerLivraisonCommande } from '../commandes/livraison-commande.ts';
import { echecVersement, encaisserVersement } from '../echelonnement/service.ts';
import type { Cartographie } from '../cartographie/index.ts';
import { journaliser } from '../audit/service.ts';
import { repartitionCoherente } from '../finance/ecritures.ts';

export interface PaiementDeps {
  db: Db;
  mypvit: MyPvitClient;
  cartographie: Cartographie;
  redirections: { successCode: string; failureCode: string };
}

export type ChoixPaiement =
  | { canal: 'MOBILE_MONEY'; operateur: 'AIRTEL_MONEY' | 'MOOV_MONEY'; numero: string }
  | { canal: 'CARTE' };

async function chargerCommandeDuClient(db: Db, user: AuthUser, commandeId: string) {
  const [c] = await db.select().from(commandes).where(and(eq(commandes.id, commandeId), eq(commandes.userId, user.id))).limit(1);
  if (!c) throw notFound('Commande introuvable');
  return c;
}

export async function initierPaiement(deps: PaiementDeps, user: AuthUser, commandeId: string, choix: ChoixPaiement) {
  const c0 = await chargerCommandeDuClient(deps.db, user, commandeId);
  const lignes = await deps.db.select().from(lignesCommande).where(eq(lignesCommande.commandeId, commandeId));
  await verifierDisponibilite(deps.db, lignes.map((l) => ({ produitId: l.produitId, quantite: l.quantite })));

  const livraison = await calculerLivraison(deps, c0, lignes);

  // 1. Étape atomique : le panier passe en attente de paiement, les frais sont fixés, une transaction est créée. Le stock est réservé dans la même transaction.
  const { transaction: t, commande: c } = await deps.db.transaction(async (tx) => {
    const [cmd] = await tx.select().from(commandes).where(eq(commandes.id, c0.id)).for('update');
    if (!cmd || cmd.statut !== 'PANIER') throw conflict('Cette commande n’est plus au panier');
    await reserverPourCommande(tx, commandeId, lignes.map((l) => ({ produitId: l.produitId, quantite: l.quantite })));
    const maj = await figerLivraisonCommande(tx, cmd.id, cmd.sousTotalFcfa, livraison);
    const existantes = await tx.select({ id: transactions.id }).from(transactions).where(eq(transactions.commandeId, commandeId));
    const referenceMarchand = `${cmd.reference}-${existantes.length + 1}`;
    await tx.update(commandes).set({ statut: 'EN_ATTENTE_PAIEMENT' }).where(eq(commandes.id, commandeId));
    const [nouvelle] = await tx
      .insert(transactions)
      .values({
        commandeId,
        canal: choix.canal,
        operateur: choix.canal === 'MOBILE_MONEY' ? choix.operateur : null,
        referenceMarchand,
        montantFcfa: maj.totalFcfa,
        statut: 'PENDING',
      })
      .returning();
    return { transaction: nouvelle, commande: maj };
  });

  // 2. Appel à MyPVit, hors transaction de base de données.
  try {
    if (choix.canal === 'MOBILE_MONEY') {
      const r = await deps.mypvit.initiatePayment({
        reference: t.referenceMarchand,
        amount: c.totalFcfa,
        operatorCode: choix.operateur,
        customerMsisdn: choix.numero,
        freeInfo: c.reference,
      });
      await deps.db.update(transactions).set({ referenceFournisseur: r.referenceId, statut: r.nzeStatus, dernierControle: new Date() }).where(eq(transactions.id, t.id));
      if (r.nzeStatus === 'FAILED') await appliquer(deps.db, t.id, 'FAILED');
      return { transactionId: t.id, statut: r.nzeStatus, urlPaiement: null };
    }
    const lien = await deps.mypvit.createPaymentLink({
      reference: t.referenceMarchand,
      amount: c.totalFcfa,
      successCode: deps.redirections.successCode,
      failureCode: deps.redirections.failureCode,
      freeInfo: c.reference,
    });
    await deps.db.update(transactions).set({ urlPaiement: lien.checkoutUrl }).where(eq(transactions.id, t.id));
    return { transactionId: t.id, statut: 'PENDING' as NzeStatus, urlPaiement: lien.checkoutUrl };
  } catch (err) {
    // Résultat inconnu : ni succès ni échec supposé. Le paiement sera vérifié avant toute nouvelle tentative.
    await deps.db.update(transactions).set({ statut: 'UNCERTAIN' }).where(eq(transactions.id, t.id));
    log('error', 'paiement_initiation_incertaine', { transaction: t.id });
    throw err;
  }
}

// Vérifie le statut auprès de MyPVit, puis applique le résultat. Un montant différent rend le statut incertain.
export async function verifierTransaction(deps: Pick<PaiementDeps, 'db' | 'mypvit'>, transactionId: string): Promise<NzeStatus> {
  const [t] = await deps.db.select().from(transactions).where(eq(transactions.id, transactionId)).limit(1);
  if (!t) throw notFound('Transaction introuvable');
  if (t.statut === 'SUCCESS' || t.statut === 'FAILED') return t.statut;

  const identifiant = t.referenceFournisseur ?? t.referenceMarchand;
  const statut = await deps.mypvit.getTransactionStatus(identifiant, 'PAYMENT', t.operateur);
  let nouveau: NzeStatus = statut.nzeStatus;
  if (statut.amount !== null && statut.amount !== t.montantFcfa) {
    log('warn', 'montant_incoherent', { transaction: t.id });
    nouveau = 'UNCERTAIN';
  }
  return appliquer(deps.db, transactionId, nouveau);
}

// Rattrapage : un paiement resté en attente au-delà de ageMinutes est vérifié auprès de MyPVit.
// Un statut non tranché reste en attente. Une erreur sur une transaction n'arrête pas les autres.
export async function rattraperPaiementsEnAttente(
  deps: Pick<PaiementDeps, 'db' | 'mypvit'>,
  ageMinutes = 5,
): Promise<{ examines: number; resolus: number; restants: number; erreurs: number }> {
  const seuil = new Date(Date.now() - ageMinutes * 60_000);
  const enAttente = await deps.db
    .select({ id: transactions.id })
    .from(transactions)
    .where(and(eq(transactions.statut, 'PENDING'), lt(transactions.createdAt, seuil)));
  let resolus = 0;
  let erreurs = 0;
  for (const t of enAttente) {
    try {
      const statut = await verifierTransaction(deps, t.id);
      if (statut === 'SUCCESS' || statut === 'FAILED') resolus += 1;
    } catch {
      erreurs += 1;
      log('error', 'rattrapage_echec', { transaction: t.id });
    }
  }
  return { examines: enAttente.length, resolus, restants: enAttente.length - resolus - erreurs, erreurs };
}

// Applique un statut à une transaction. Idempotent : un statut final n'est jamais modifié.
export async function appliquer(db: Db, transactionId: string, nouveau: NzeStatus): Promise<NzeStatus> {
  return db.transaction(async (tx) => {
    const [t] = await tx.select().from(transactions).where(eq(transactions.id, transactionId)).for('update');
    if (!t) throw notFound('Transaction introuvable');
    if (t.statut === 'SUCCESS' || t.statut === 'FAILED') return t.statut;

    await tx.update(transactions).set({ statut: nouveau, dernierControle: new Date() }).where(eq(transactions.id, transactionId));
    if (t.versementId) {
      // Paiement d'échelonnement (avance ou versement) : traité par le module échelonnement.
      if (nouveau === 'SUCCESS') await encaisserVersement(tx, t.versementId);
      if (nouveau === 'FAILED') await echecVersement(tx, t.versementId);
    } else {
      if (nouveau === 'SUCCESS') {
        // Répartition vérifiée avant toute écriture. Si elle est incohérente, le paiement reçu reste enregistré
        // (une annulation de la transaction laisserait le client débité sans trace) et une alerte est journalisée.
        if (await repartitionCoherente(tx, t.commandeId)) await marquerPayee(tx, t.commandeId);
        else await journaliser(tx, { acteurId: null, action: 'PAIEMENT_ECRITURE_ECHEC', cibleType: 'transaction', cibleId: t.id, details: { commandeId: t.commandeId } });
      }
      if (nouveau === 'FAILED') await marquerEchec(tx, t.commandeId);
    }
    return nouveau;
  });
}

// Callback MyPVit : format et signature non documentés. Seul l'identifiant sert à retrouver la transaction,
// puis le statut est demandé à MyPVit. Le contenu du callback ne décide jamais seul.
export async function traiterCallback(deps: PaiementDeps, corps: unknown): Promise<{ traite: boolean }> {
  const o = corps && typeof corps === 'object' ? (corps as Record<string, unknown>) : {};
  const candidats = [o.merchant_reference_id, o.merchantReferenceId, o.reference_id, o.referenceId, o.transactionId, o.reference]
    .filter((v): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64);
  for (const c of candidats) {
    const [t] = await deps.db
      .select({ id: transactions.id })
      .from(transactions)
      .where(or(eq(transactions.referenceMarchand, c), eq(transactions.referenceFournisseur, c)))
      .limit(1);
    if (t) {
      await verifierTransaction(deps, t.id);
      return { traite: true };
    }
  }
  // Versement (retrait commerçant) : même principe, le statut est vérifié auprès de MyPVit.
  for (const c of candidats) {
    const [d] = await deps.db.select({ id: demandesRetrait.id }).from(demandesRetrait)
      .where(or(eq(demandesRetrait.referenceMarchand, c), eq(demandesRetrait.referenceFournisseur, c))).limit(1);
    if (d) {
      await verifierVersement({ db: deps.db, mypvit: deps.mypvit }, d.id, null);
      return { traite: true };
    }
  }
  log('warn', 'callback_sans_transaction');
  return { traite: false };
}

