// Stock géré par le magasin. Réservation au paiement : un article est réservé quand un paiement démarre,
// vendu quand le paiement est confirmé, libéré en cas d'échec ou d'annulation. Chaque mouvement est tracé.
// Invariant : 0 <= reserve <= disponible. Quantité vendable = disponible - reserve.
import { and, eq, inArray } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import { commandes, lignesCommande, mouvementsStock, produits, signalementsStock, stockNiveaux, users } from '../../db/schema.ts';
import { conflict, forbidden, notFound } from '../../core/errors.ts';
import { log } from '../../core/logger.ts';
import { journaliser } from '../audit/service.ts';
import { notifier } from '../notifications/service.ts';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export interface LigneStock { produitId: string; quantite: number }

async function verrouiller(tx: Tx, produitId: string) {
  const [niveau] = await tx.select().from(stockNiveaux).where(eq(stockNiveaux.produitId, produitId)).for('update');
  if (!niveau) throw notFound('Stock introuvable pour ce produit');
  return niveau;
}

async function mouvement(
  tx: Tx,
  p: { produitId: string; type: string; deltaDisponible: number; deltaReserve: number; disponibleApres: number; reserveApres: number; commandeId?: string; acteurId?: string; motif?: string; bordereauId?: string },
) {
  await tx.insert(mouvementsStock).values({
    produitId: p.produitId, type: p.type, deltaDisponible: p.deltaDisponible, deltaReserve: p.deltaReserve,
    disponibleApres: p.disponibleApres, reserveApres: p.reserveApres, commandeId: p.commandeId, acteurId: p.acteurId, motif: p.motif,
    bordereauId: p.bordereauId,
  });
}

// Verrous pris dans un ordre fixe (identifiant du produit) : deux paiements ne peuvent pas s'attendre mutuellement.
function dansLOrdre(lignes: LigneStock[]): LigneStock[] {
  return [...lignes].sort((a, b) => a.produitId.localeCompare(b.produitId));
}

// Contrôle indicatif au lancement du paiement (sans verrou). La réservation réelle se fait sous verrou.
export async function verifierDisponibilite(db: Db, lignes: LigneStock[]): Promise<void> {
  for (const l of lignes) {
    const [n] = await db
      .select({ disponible: stockNiveaux.disponible, reserve: stockNiveaux.reserve, etat: stockNiveaux.etat })
      .from(stockNiveaux)
      .where(eq(stockNiveaux.produitId, l.produitId))
      .limit(1);
    if (!n || n.disponible - n.reserve < l.quantite) throw conflict('Stock insuffisant pour un article de votre panier');
    if (n.etat !== 'DISPONIBLE') throw conflict('Article indisponible : collecte, indisponibilité ou vérification en cours');
  }
}

// États du stock (cahier V3.0 §10.2). Un article non DISPONIBLE ne peut pas être vendu.
export const ETATS_STOCK = ['DISPONIBLE', 'COLLECTE', 'INDISPONIBLE', 'A_CONFIRMER'] as const;
export type EtatStock = (typeof ETATS_STOCK)[number];

export async function changerEtatStock(db: Db, produitId: string, etat: EtatStock, acteurId: string, motif?: string) {
  return db.transaction(async (tx) => {
    const niveau = await verrouiller(tx, produitId);
    if (niveau.etat === etat) throw conflict(`Le stock est déjà à l’état ${etat}`);
    await tx.update(stockNiveaux).set({ etat, misAJour: new Date() }).where(eq(stockNiveaux.produitId, produitId));
    await mouvement(tx, {
      produitId, type: 'ETAT', deltaDisponible: 0, deltaReserve: 0,
      disponibleApres: niveau.disponible, reserveApres: niveau.reserve, acteurId,
      motif: `Passage à ${etat}${motif ? ` : ${motif}` : ''}`,
    });
    return { produitId, etat };
  });
}

// Réservation au lancement d'un paiement, dans la transaction qui crée ce paiement (verrous pris ici).
// Refus si la quantité vendable ne suffit pas : la transaction entière est annulée, aucun paiement n'est créé.
export async function reserverPourCommande(tx: Tx, commandeId: string, lignes: LigneStock[]): Promise<void> {
  const [cmd] = await tx.select({ stockStatut: commandes.stockStatut }).from(commandes).where(eq(commandes.id, commandeId)).for('update');
  if (!cmd) throw notFound('Commande introuvable');
  if (cmd.stockStatut === 'RESERVE') throw conflict('Les articles de cette commande sont déjà réservés pour un paiement en cours');
  for (const l of dansLOrdre(lignes)) {
    const niveau = await verrouiller(tx, l.produitId);
    if (niveau.etat !== 'DISPONIBLE') throw conflict('Article indisponible : collecte, indisponibilité ou vérification en cours');
    if (niveau.disponible - niveau.reserve < l.quantite) throw conflict('Stock insuffisant pour un article de votre panier');
    const reserve = niveau.reserve + l.quantite;
    await tx.update(stockNiveaux).set({ reserve, misAJour: new Date() }).where(eq(stockNiveaux.produitId, l.produitId));
    await mouvement(tx, {
      produitId: l.produitId, type: 'RESERVATION', deltaDisponible: 0, deltaReserve: l.quantite,
      disponibleApres: niveau.disponible, reserveApres: reserve, commandeId,
    });
    await alerterStockFaible(tx, l.produitId, niveau.disponible - niveau.reserve, niveau.disponible - reserve);
  }
  await tx.update(commandes).set({ stockStatut: 'RESERVE' }).where(eq(commandes.id, commandeId));
}

// Libération : échec de paiement, annulation d'un plan en attente. Sans réservation active, ne fait rien.
export async function libererPourCommande(tx: Tx, commandeId: string): Promise<void> {
  const [cmd] = await tx.select({ stockStatut: commandes.stockStatut }).from(commandes).where(eq(commandes.id, commandeId)).for('update');
  if (!cmd || cmd.stockStatut !== 'RESERVE') return;
  const lignes = await tx
    .select({ produitId: lignesCommande.produitId, quantite: lignesCommande.quantite })
    .from(lignesCommande)
    .where(eq(lignesCommande.commandeId, commandeId));
  for (const l of dansLOrdre(lignes)) {
    const niveau = await verrouiller(tx, l.produitId);
    const reserve = Math.max(0, niveau.reserve - l.quantite);
    await tx.update(stockNiveaux).set({ reserve, misAJour: new Date() }).where(eq(stockNiveaux.produitId, l.produitId));
    await mouvement(tx, {
      produitId: l.produitId, type: 'LIBERATION', deltaDisponible: 0, deltaReserve: reserve - niveau.reserve,
      disponibleApres: niveau.disponible, reserveApres: reserve, commandeId,
    });
  }
  await tx.update(commandes).set({ stockStatut: 'LIBERE' }).where(eq(commandes.id, commandeId));
}

// Vente confirmée : le stock vendu sort du disponible et de la réservation, une seule fois par commande.
// Commande sans réservation (paiement lancé avant cette version) : ancien chemin. Si le magasin n'a plus assez,
// le paiement reste valide, le stock ne descend pas sous les quantités réservées pour d'autres paiements,
// et l'écart est tracé pour vérification.
export async function vendrePourCommande(tx: Tx, commandeId: string, lignes: LigneStock[]): Promise<void> {
  const [cmd] = await tx.select({ stockStatut: commandes.stockStatut }).from(commandes).where(eq(commandes.id, commandeId)).for('update');
  if (!cmd || cmd.stockStatut === 'VENDU') return;
  const reservee = cmd.stockStatut === 'RESERVE';
  for (const l of dansLOrdre(lignes)) {
    const niveau = await verrouiller(tx, l.produitId);
    if (reservee) {
      const disponible = niveau.disponible - l.quantite;
      const reserve = niveau.reserve - l.quantite;
      if (disponible < 0 || reserve < 0) log('error', 'reservation_incoherente', { produit: l.produitId, commande: commandeId });
      const disponibleApres = Math.max(0, disponible);
      const reserveApres = Math.max(0, reserve);
      await tx.update(stockNiveaux).set({ disponible: disponibleApres, reserve: reserveApres, misAJour: new Date() }).where(eq(stockNiveaux.produitId, l.produitId));
      await mouvement(tx, {
        produitId: l.produitId, type: 'VENTE', deltaDisponible: disponibleApres - niveau.disponible, deltaReserve: reserveApres - niveau.reserve,
        disponibleApres, reserveApres, commandeId,
      });
    } else {
      const ecart = niveau.disponible - niveau.reserve < l.quantite;
      if (ecart) log('warn', 'stock_insuffisant_apres_paiement', { produit: l.produitId });
      const disponible = Math.max(niveau.reserve, niveau.disponible - l.quantite);
      await tx.update(stockNiveaux).set({ disponible, misAJour: new Date() }).where(eq(stockNiveaux.produitId, l.produitId));
      await mouvement(tx, {
        produitId: l.produitId, type: 'VENTE', deltaDisponible: disponible - niveau.disponible, deltaReserve: 0,
        disponibleApres: disponible, reserveApres: niveau.reserve, commandeId,
        motif: ecart ? 'STOCK_INSUFFISANT_APRES_PAIEMENT' : undefined,
      });
      await alerterStockFaible(tx, l.produitId, niveau.disponible - niveau.reserve, disponible - niveau.reserve);
    }
  }
  await tx.update(commandes).set({ stockStatut: 'VENDU' }).where(eq(commandes.id, commandeId));
}

// Seuil d'alerte : quantité vendable au-dessous de laquelle l'administration et le partenaire sont prévenus.
// Même seuil que l'affichage client (catalogue). L'alerte part une seule fois, au franchissement du seuil.
export const SEUIL_STOCK_FAIBLE = 3;
const ROLES_ALERTE_ADMIN = ['admin_principal', 'admin_secondaire'];

async function alerterStockFaible(tx: Tx, produitId: string, vendableAvant: number, vendableApres: number): Promise<void> {
  if (!(vendableAvant > SEUIL_STOCK_FAIBLE && vendableApres <= SEUIL_STOCK_FAIBLE)) return;
  const [p] = await tx.select({ nom: produits.nom, entrepriseId: produits.entrepriseId }).from(produits).where(eq(produits.id, produitId)).limit(1);
  if (!p) return;
  const parametres = { produit: p.nom, quantite: Math.max(0, vendableApres) };
  const admins = await tx.select({ id: users.id }).from(users).where(inArray(users.role, ROLES_ALERTE_ADMIN));
  const partenaires = await tx.select({ id: users.id }).from(users).where(and(eq(users.entrepriseId, p.entrepriseId), eq(users.role, 'partenaire')));
  for (const u of [...admins, ...partenaires]) {
    await notifier(tx, {
      destinataireId: u.id, type: 'STOCK_FAIBLE', titre: 'Stock faible', message: `${p.nom} : il reste ${parametres.quantite} article(s) vendable(s).`,
      parametres, cibleType: 'produit', cibleId: produitId,
    });
  }
}

// Entrée de stock par une collecte validée (ou par la levée d'un blocage après validation). Traçable jusqu'au bordereau.
export async function entrerStockCollecte(
  tx: Tx,
  p: { type: 'COLLECTE' | 'COLLECTE_DEBLOCAGE'; produitId: string; quantite: number; bordereauId: string; acteurId: string; motif: string },
): Promise<void> {
  const niveau = await verrouiller(tx, p.produitId);
  const disponible = niveau.disponible + p.quantite;
  await tx.update(stockNiveaux).set({ disponible, misAJour: new Date() }).where(eq(stockNiveaux.produitId, p.produitId));
  await mouvement(tx, {
    produitId: p.produitId, type: p.type, deltaDisponible: p.quantite, deltaReserve: 0,
    disponibleApres: disponible, reserveApres: niveau.reserve, acteurId: p.acteurId, motif: p.motif, bordereauId: p.bordereauId,
  });
}

// Correction exceptionnelle (mise en place, erreur de saisie). Le magasin gère le stock au quotidien.
export async function ajusterStock(db: Db, produitId: string, delta: number, motif: string, acteurId: string) {
  return db.transaction(async (tx) => {
    const niveau = await verrouiller(tx, produitId);
    const disponible = niveau.disponible + delta;
    if (disponible < 0) throw conflict('Ajustement impossible : le stock disponible deviendrait négatif');
    if (disponible < niveau.reserve) throw conflict('Ajustement impossible : des articles sont réservés pour un paiement en cours');
    await tx.update(stockNiveaux).set({ disponible, misAJour: new Date() }).where(eq(stockNiveaux.produitId, produitId));
    await mouvement(tx, { produitId, type: 'INVENTAIRE', deltaDisponible: delta, deltaReserve: 0, disponibleApres: disponible, reserveApres: niveau.reserve, acteurId, motif });
    await alerterStockFaible(tx, produitId, niveau.disponible - niveau.reserve, disponible - niveau.reserve);
    await journaliser(tx, { acteurId, action: 'STOCK_AJUSTE', cibleType: 'produit', cibleId: produitId, details: { delta, motif } });
    return { disponible, reserve: niveau.reserve };
  });
}

// Un partenaire signale un événement de stock sur un de SES produits. Il s'applique tout de suite.
export async function signalerStock(db: Db, acteur: { id: string; role: string; entrepriseId: string | null }, produitId: string, genre: string, quantite: number) {
  if (acteur.role !== 'partenaire' || !acteur.entrepriseId) throw forbidden();
  return db.transaction(async (tx) => {
    const [p] = await tx.select({ entrepriseId: produits.entrepriseId }).from(produits).where(eq(produits.id, produitId)).limit(1);
    if (!p || p.entrepriseId !== acteur.entrepriseId) throw notFound('Produit introuvable');
    const niveau = await verrouiller(tx, produitId);
    let delta: number;
    if (genre === 'VENTE') delta = -quantite;
    else if (genre === 'RETOUR') delta = quantite;
    else if (genre === 'VARIATION') delta = quantite;
    else delta = -niveau.disponible; // RUPTURE : disponible ramené à zéro
    const disponible = niveau.disponible + delta;
    if (disponible < 0) throw conflict('Signalement impossible : le stock deviendrait négatif');
    if (disponible < niveau.reserve) throw conflict('Signalement impossible : des articles sont réservés pour un paiement en cours');
    await tx.update(stockNiveaux).set({ disponible, misAJour: new Date() }).where(eq(stockNiveaux.produitId, produitId));
    await mouvement(tx, { produitId, type: `SIGNALEMENT_${genre}`, deltaDisponible: delta, deltaReserve: 0, disponibleApres: disponible, reserveApres: niveau.reserve, acteurId: acteur.id });
    await alerterStockFaible(tx, produitId, niveau.disponible - niveau.reserve, disponible - niveau.reserve);
    const [s] = await tx
      .insert(signalementsStock)
      .values({ produitId, entrepriseId: acteur.entrepriseId as string, acteurId: acteur.id, genre, quantite, statut: 'APPLIQUE' })
      .returning();
    return { ...s, disponibleApres: disponible };
  });
}

export async function produitsDuPartenaire(db: Db, entrepriseId: string) {
  return db
    .select({ id: produits.id, nom: produits.nom, prixFcfa: produits.prixFcfa, disponible: stockNiveaux.disponible, etat: stockNiveaux.etat })
    .from(produits)
    .leftJoin(stockNiveaux, eq(stockNiveaux.produitId, produits.id))
    .where(eq(produits.entrepriseId, entrepriseId));
}
