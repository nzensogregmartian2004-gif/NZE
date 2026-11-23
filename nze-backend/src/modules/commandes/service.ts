import { distanceMetres } from '../livraisons/pricing.ts';
import { plansEcheloneces } from '../../db/schema.ts';
import { journaliser } from '../audit/service.ts';
import { notifier } from '../notifications/service.ts';
import type { Page } from '../../core/pagination.ts';
// Commandes : prix et frais recalculés côté serveur, commission figée par ligne, stock réservé dans la même transaction.
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import { commandes, lignesCommande, lignesLivraison, livraisons, produits, reclamations, transactions } from '../../db/schema.ts';
import { badRequest, conflict, notFound } from '../../core/errors.ts';
import { commissionOf } from '../../core/money.ts';
import type { AuthUser } from '../../core/auth.ts';
import { tauxActif } from '../finance/commissions.ts';
import { fraisLivraison } from '../livraisons/pricing.ts';
import type { Cartographie } from '../cartographie/index.ts';
import { libererPourCommande, vendrePourCommande } from '../stock/service.ts';
import { repartirVente } from '../finance/ecritures.ts';
import { MESSAGE_PAIEMENT_SUR_PLACE, origineLivraison, tarifActif } from '../parametres/service.ts';

export interface DemandeCommande {
  lignes: { produitId: string; quantite: number }[];
  reception: 'LIVRAISON' | 'RETRAIT';
  livraison?: { latitude: number; longitude: number };
}

const STAFF = ['admin_principal', 'admin_secondaire'];

interface LigneCalculee {
  produitId: string;
  entrepriseId: string;
  quantite: number;
  prixUnitaireFcfa: number;
  montantLigneFcfa: number;
  tauxCommissionBps: number;
  commissionFcfa: number;
  garantieJours: number | null;
}

export function genererReference(): string {
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const alea = Math.random().toString(36).slice(2, 7).toUpperCase().padEnd(5, 'X');
  return `NZE-${date}-${alea}`;
}

export async function creerCommande(db: Db, user: AuthUser, demande: DemandeCommande, cartographie: Cartographie) {
  const parProduit = new Map<string, number>();
  for (const l of demande.lignes) {
    if (!Number.isInteger(l.quantite) || l.quantite <= 0 || l.quantite > 100) throw badRequest('Quantité invalide');
    parProduit.set(l.produitId, (parProduit.get(l.produitId) ?? 0) + l.quantite);
  }
  if (parProduit.size === 0) throw badRequest('Le panier est vide');

  const ids = [...parProduit.keys()];
  const rangees = await db.select().from(produits).where(inArray(produits.id, ids));
  if (rangees.length !== ids.length) throw notFound('Un article du panier n’existe plus');
  if (rangees.some((p) => p.statut !== 'PUBLIE')) throw conflict('Un article n’est plus disponible à la vente');

  const maintenant = new Date();
  const lignes: LigneCalculee[] = [];
  let sousTotal = 0;
  for (const p of rangees) {
    const quantite = parProduit.get(p.id) as number;
    const montant = p.prixFcfa * quantite;
    const taux = await tauxActif(db, p.entrepriseId, maintenant); // lève une erreur si la commission n'est pas définie
    lignes.push({
      produitId: p.id,
      entrepriseId: p.entrepriseId,
      quantite,
      prixUnitaireFcfa: p.prixFcfa,
      montantLigneFcfa: montant,
      tauxCommissionBps: taux,
      commissionFcfa: commissionOf(montant, taux),
      garantieJours: p.garantieJours,
    });
    sousTotal += montant;
  }

  let frais = 0;
  let livraison: {
    latitude: number | null; longitude: number | null; pointFixeId: string | null; tarifId: string | null; distanceM: number | null;
    fournisseurDistance: string | null; distanceCalculeeLe: Date | null;
    origineLatitude: number | null; origineLongitude: number | null;
  } = { latitude: null, longitude: null, pointFixeId: null, tarifId: null, distanceM: null, fournisseurDistance: null, distanceCalculeeLe: null, origineLatitude: null, origineLongitude: null };
  if (demande.reception === 'LIVRAISON') {
    if (!demande.livraison) throw badRequest('Position de livraison requise');
    const origine = await origineLivraison(db, rangees.map((p) => p.entrepriseId), maintenant);
    const tarif = await tarifActif(db, maintenant);
    const trajet = await cartographie.distanceRoutiere(origine, demande.livraison);
    const distance = trajet.distanceM;
    frais = fraisLivraison(distance, tarif);
    livraison = {
      latitude: demande.livraison.latitude,
      longitude: demande.livraison.longitude,
      pointFixeId: origine.pointFixeId,
      tarifId: tarif.id,
      distanceM: distance,
      fournisseurDistance: cartographie.fournisseur,
      distanceCalculeeLe: new Date(),
      origineLatitude: origine.latitude,
      origineLongitude: origine.longitude,
    };
  }

  return db.transaction(async (tx) => {
    const [commande] = await tx
      .insert(commandes)
      .values({
        reference: genererReference(),
        userId: user.id,
        reception: demande.reception,
        latitude: livraison.latitude,
        longitude: livraison.longitude,
        pointFixeId: livraison.pointFixeId,
        tarifId: livraison.tarifId,
        distanceM: livraison.distanceM,
        fournisseurDistance: livraison.fournisseurDistance,
        distanceCalculeeLe: livraison.distanceCalculeeLe,
        origineLatitude: livraison.origineLatitude,
        origineLongitude: livraison.origineLongitude,
        fraisLivraisonFcfa: frais,
        sousTotalFcfa: sousTotal,
        totalFcfa: sousTotal + frais,
      })
      .returning();
    await tx.insert(lignesCommande).values(lignes.map((l) => ({ ...l, commandeId: commande.id })));
    // Pas de réservation au panier : le stock n'est réservé qu'au lancement du paiement.
    return { ...commande, lignes: lignes.map(({ commissionFcfa, tauxCommissionBps, ...client }) => client) };
  });
}

// Lignes effectivement remises au client : livraison LIVREE ou PARTIELLE, clôturée, avec une quantité remise.
async function lignesRemises(db: Db, ligneIds: string[]): Promise<Set<string>> {
  if (ligneIds.length === 0) return new Set();
  const rows = await db
    .select({ ligneCommandeId: lignesLivraison.ligneCommandeId, quantiteLivree: lignesLivraison.quantiteLivree, clotureeLe: livraisons.clotureeLe })
    .from(lignesLivraison)
    .innerJoin(livraisons, eq(livraisons.id, lignesLivraison.livraisonId))
    .where(and(inArray(lignesLivraison.ligneCommandeId, ligneIds), inArray(livraisons.statut, ['LIVREE', 'PARTIELLE'])));
  return new Set(rows.filter((r) => r.quantiteLivree > 0 && r.clotureeLe !== null).map((r) => r.ligneCommandeId));
}

// Lignes qui ont déjà une réclamation ouverte ou acceptée (une seule à la fois par article).
async function lignesAvecReclamation(db: Db, ligneIds: string[]): Promise<Set<string>> {
  if (ligneIds.length === 0) return new Set();
  const rows = await db
    .select({ ligneCommandeId: reclamations.ligneCommandeId })
    .from(reclamations)
    .where(and(inArray(reclamations.ligneCommandeId, ligneIds), inArray(reclamations.statut, ['OUVERTE', 'ACCEPTEE'])));
  return new Set(rows.map((r) => r.ligneCommandeId));
}

// Vue client : jamais la commission ni le taux interne. L'identifiant de ligne sert à déposer une réclamation ;
// « livree » indique ce qui a été remis, « reclamationEnCours » si un dossier est déjà ouvert sur la ligne.
export async function lireCommande(db: Db, user: AuthUser, id: string) {
  const [c] = await db.select().from(commandes).where(eq(commandes.id, id)).limit(1);
  if (!c || (c.userId !== user.id && !STAFF.includes(user.role))) throw notFound('Commande introuvable');
  const brutes = await db
    .select({ id: lignesCommande.id, produitId: lignesCommande.produitId, nomArticle: produits.nom, quantite: lignesCommande.quantite, prixUnitaireFcfa: lignesCommande.prixUnitaireFcfa, montantLigneFcfa: lignesCommande.montantLigneFcfa, garantieJours: lignesCommande.garantieJours })
    .from(lignesCommande)
    .innerJoin(produits, eq(produits.id, lignesCommande.produitId))
    .where(eq(lignesCommande.commandeId, id));
  const ids = brutes.map((l) => l.id);
  const remises = await lignesRemises(db, ids);
  const enCours = await lignesAvecReclamation(db, ids);
  const lignes = brutes.map((l) => ({ ...l, livree: remises.has(l.id), reclamationEnCours: enCours.has(l.id) }));
  const paiements = await db
    .select({ id: transactions.id, canal: transactions.canal, operateur: transactions.operateur, statut: transactions.statut, urlPaiement: transactions.urlPaiement, montantFcfa: transactions.montantFcfa })
    .from(transactions)
    .where(eq(transactions.commandeId, id))
    .orderBy(desc(transactions.createdAt));
  const { latitude, longitude, pointFixeId, tarifId, ...publique } = c;
  const [derniereLivraison] = await db
    .select({ statut: livraisons.statut, latitude: livraisons.latitude, longitude: livraisons.longitude, livreurLatitude: livraisons.livreurLatitude, livreurLongitude: livraisons.livreurLongitude, livreurPositionLe: livraisons.livreurPositionLe })
    .from(livraisons)
    .where(eq(livraisons.commandeId, id))
    .orderBy(desc(livraisons.createdAt))
    .limit(1);
  const suivi = suiviCommande(c.statut, c.etapePreparation, derniereLivraison?.statut ?? null);
  // Suivi de la livraison pour le client : distance restante seulement si le livreur a transmis sa position.
  const l = derniereLivraison;
  const livraisonClient = l
    ? {
        statut: l.statut,
        positionMiseAJourLe: l.livreurPositionLe,
        distanceRestanteMetres:
          l.livreurLatitude !== null && l.livreurLongitude !== null && l.latitude !== null && l.longitude !== null
            ? Math.round(distanceMetres({ latitude: l.livreurLatitude, longitude: l.livreurLongitude }, { latitude: l.latitude, longitude: l.longitude }))
            : null,
      }
    : null;
  const [plan] = await db.select({ id: plansEcheloneces.id }).from(plansEcheloneces).where(eq(plansEcheloneces.commandeId, id)).limit(1);
  return {
    suivi, livraison: livraisonClient, echelonnementId: plan?.id ?? null, ...publique, lignes, paiements };
}

export async function listerCommandes(db: Db, user: AuthUser, page: Page) {
  return db
    .select({ id: commandes.id, reference: commandes.reference, statut: commandes.statut, totalFcfa: commandes.totalFcfa, createdAt: commandes.createdAt })
    .from(commandes)
    .where(eq(commandes.userId, user.id))
    .orderBy(desc(commandes.createdAt), desc(commandes.id))
    .limit(page.limite)
    .offset(page.decalage);
}

// Le panier s'annule à tout moment, sans effet sur le stock. Une commande en cours de paiement ne s'annule pas.
export async function annulerCommande(db: Db, user: AuthUser, id: string) {
  return db.transaction(async (tx) => {
    const [c] = await tx.select().from(commandes).where(and(eq(commandes.id, id), eq(commandes.userId, user.id))).for('update');
    if (!c) throw notFound('Commande introuvable');
    if (c.statut !== 'PANIER') throw conflict('Un paiement est en cours ou terminé : annulation impossible');
    await tx.update(commandes).set({ statut: 'ANNULEE' }).where(eq(commandes.id, id));
    return { id, statut: 'ANNULEE' };
  });
}

// Appelée quand le paiement est confirmé : la commande passe à PAYEE et le stock est vendu.
export async function marquerPayee(tx: Parameters<Parameters<Db['transaction']>[0]>[0], commandeId: string) {
  const lignes = await tx.select().from(lignesCommande).where(eq(lignesCommande.commandeId, commandeId));
  await tx.update(commandes).set({ statut: 'PAYEE', payeLe: new Date() }).where(eq(commandes.id, commandeId));
  await vendrePourCommande(tx, commandeId, lignes.map((l) => ({ produitId: l.produitId, quantite: l.quantite })));
  await repartirVente(tx, commandeId);
}

// Paiement échoué : la réservation du stock est libérée, et la commande revient au panier (nouvelle tentative possible).
export async function marquerEchec(tx: Parameters<Parameters<Db['transaction']>[0]>[0], commandeId: string) {
  await libererPourCommande(tx, commandeId);
  await tx.update(commandes).set({ statut: 'PANIER' }).where(eq(commandes.id, commandeId));
}

// « Payer sur place » : simple information. Le client voit le message et peut payer en ligne à tout moment.
export async function choisirPaiementSurPlace(db: Db, user: AuthUser, id: string) {
  const [c] = await db.select().from(commandes).where(and(eq(commandes.id, id), eq(commandes.userId, user.id))).limit(1);
  if (!c) throw notFound('Commande introuvable');
  if (c.statut !== 'PANIER') throw conflict('Cette commande n’est plus au panier');
  await db.update(commandes).set({ choixSurPlace: true }).where(eq(commandes.id, id));
  return { id, message: MESSAGE_PAIEMENT_SUR_PLACE };
}

// Suivi affiché au client, calculé à partir du statut, de l'étape de préparation et de la dernière livraison.
export type SuiviCommande = 'CONFIRMEE' | 'EN_PREPARATION' | 'PRETE' | 'EN_LIVRAISON' | 'LIVREE' | null;

export function suiviCommande(statut: string, etape: string | null, livraison: string | null): SuiviCommande {
  if (statut !== 'PAYEE') return null;
  if (livraison === 'LIVREE') return 'LIVREE';
  if (livraison === 'EN_ROUTE' || livraison === 'ARRIVE') return 'EN_LIVRAISON';
  if (etape === 'PRETE') return 'PRETE';
  if (etape === 'EN_PREPARATION') return 'EN_PREPARATION';
  return 'CONFIRMEE';
}

// Étapes de préparation saisies par l'administration. Refusées une fois la commande partie en livraison.
const LIVRAISON_DEJA_PARTIE = ['EN_ROUTE', 'ARRIVE', 'LIVREE', 'PARTIELLE'];

export async function definirEtapePreparation(db: Db, admin: AuthUser, id: string, etape: 'EN_PREPARATION' | 'PRETE') {
  return db.transaction(async (tx) => {
    const [c] = await tx.select().from(commandes).where(eq(commandes.id, id)).for('update');
    if (!c) throw notFound('Commande introuvable');
    if (c.statut !== 'PAYEE') throw conflict('La préparation ne se suit qu’après paiement');
    const [derniere] = await tx
      .select({ statut: livraisons.statut })
      .from(livraisons)
      .where(eq(livraisons.commandeId, id))
      .orderBy(desc(livraisons.createdAt))
      .limit(1);
    if (derniere && LIVRAISON_DEJA_PARTIE.includes(derniere.statut)) throw conflict('La commande est déjà partie en livraison');
    const attendue = etape === 'EN_PREPARATION' ? null : 'EN_PREPARATION';
    if (c.etapePreparation !== attendue) {
      throw conflict(etape === 'EN_PREPARATION' ? 'La commande est déjà en préparation ou prête' : 'La commande doit être en préparation avant d’être prête');
    }
    await tx.update(commandes).set({ etapePreparation: etape }).where(eq(commandes.id, id));
    await journaliser(tx, { acteurId: admin.id, action: 'COMMANDE_ETAPE', cibleType: 'commande', cibleId: id, details: { etape } });
    const pret = etape === 'PRETE';
    await notifier(tx, {
      destinataireId: c.userId,
      type: pret ? 'COMMANDE_PRETE' : 'COMMANDE_EN_PREPARATION',
      titre: pret ? 'Commande prête' : 'Commande en préparation',
      message: pret ? 'Votre commande est prête.' : 'Votre commande est en préparation.',
      cibleType: 'commande',
      cibleId: id,
    });
    return { id, etape };
  });
}
