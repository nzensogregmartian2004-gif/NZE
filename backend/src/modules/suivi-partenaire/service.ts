import { notInArray } from 'drizzle-orm';
import type { Page } from '../../core/pagination.ts';
// Suivi du commerçant : stock, historique des mouvements, ventes, collectes et argent.
// Les heures sont celles du Gabon (UTC+1) pour le découpage « aujourd'hui ».
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import { bordereaux, ecritures, lignesBordereau, lignesCommande, mouvementsStock, produits, signalementsStock, stockNiveaux } from '../../db/schema.ts';
import { notFound } from '../../core/errors.ts';
import type { AuthUser } from '../../core/auth.ts';
import { soldeEntreprise } from '../finance/retraits.ts';

const DECALAGE_MS = 60 * 60 * 1000;

function debutJourGabon(maintenant = new Date()): Date {
  const local = new Date(maintenant.getTime() + DECALAGE_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - DECALAGE_MS);
}

// Historique fusionné : pour la page [décalage, décalage + limite[, chaque source fournit ses premières lignes jusqu'à cette fin.
export async function historiqueStock(db: Db, entrepriseId: string, page: Page) {
  const fin = page.decalage + page.limite;
  const signalements = await db
    .select({ id: signalementsStock.id, produit: produits.nom, mouvement: signalementsStock.genre, delta: signalementsStock.quantite, statut: signalementsStock.statut, date: signalementsStock.createdAt })
    .from(signalementsStock)
    .innerJoin(produits, eq(produits.id, signalementsStock.produitId))
    .where(eq(signalementsStock.entrepriseId, entrepriseId))
    .orderBy(desc(signalementsStock.createdAt), desc(signalementsStock.id))
    .limit(fin);
  const mouvements = await db
    .select({ id: mouvementsStock.id, produit: produits.nom, mouvement: mouvementsStock.type, delta: mouvementsStock.deltaDisponible, disponibleApres: mouvementsStock.disponibleApres, motif: mouvementsStock.motif, date: mouvementsStock.createdAt })
    .from(mouvementsStock)
    .innerJoin(produits, eq(produits.id, mouvementsStock.produitId))
    .where(and(eq(produits.entrepriseId, entrepriseId), notInArray(mouvementsStock.type, ['RESERVATION', 'LIBERATION'])))
    .orderBy(desc(mouvementsStock.createdAt), desc(mouvementsStock.id))
    .limit(fin);
  const lignes = [
    ...signalements.map((s) => ({ id: `s-${s.id}`, date: s.date, produit: s.produit, mouvement: s.mouvement, delta: s.delta, origine: 'SIGNALEMENT' as const, statut: s.statut, disponibleApres: null as number | null, motif: null as string | null })),
    ...mouvements.map((m) => ({ id: `m-${m.id}`, date: m.date, produit: m.produit, mouvement: m.mouvement, delta: m.delta, origine: 'SYSTEME' as const, statut: 'APPLIQUE', disponibleApres: m.disponibleApres, motif: m.motif })),
  ];
  return lignes.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(page.decalage, fin);
}

export async function resumePartenaire(db: Db, entrepriseId: string) {
  // Stock : quantités disponibles et valeur au prix de vente.
  const catalogue = await db
    .select({ prixFcfa: produits.prixFcfa, disponible: stockNiveaux.disponible })
    .from(produits)
    .leftJoin(stockNiveaux, eq(stockNiveaux.produitId, produits.id))
    .where(eq(produits.entrepriseId, entrepriseId));
  const stock = {
    produits: catalogue.length,
    ruptures: catalogue.filter((p) => (p.disponible ?? 0) <= 0).length,
    valeurFcfa: catalogue.reduce((t, p) => t + p.prixFcfa * Math.max(0, p.disponible ?? 0), 0),
  };

  // Ventes : articles et montant net perçu, aujourd'hui et sur 7 jours.
  const debutJour = debutJourGabon();
  const debut7 = new Date(debutJour.getTime() - 6 * 24 * 60 * 60 * 1000);
  const ventes = await db
    .select({ montant: ecritures.montantFcfa, quantite: lignesCommande.quantite, date: ecritures.createdAt })
    .from(ecritures)
    .leftJoin(lignesCommande, eq(lignesCommande.id, ecritures.ligneId))
    .where(and(eq(ecritures.entrepriseId, entrepriseId), eq(ecritures.categorie, 'VENTE_NET'), gte(ecritures.createdAt, debut7)));
  const bilan = (depuis: Date) => {
    const lignes = ventes.filter((v) => v.date >= depuis);
    return { articles: lignes.reduce((t, v) => t + (v.quantite ?? 0), 0), montantFcfa: lignes.reduce((t, v) => t + v.montant, 0) };
  };

  // Collectes récentes : numéro, date, statut et nombre d'articles.
  const recentes = await db
    .select({ id: bordereaux.id, numero: bordereaux.numero, statut: bordereaux.statut, date: bordereaux.createdAt })
    .from(bordereaux)
    .where(eq(bordereaux.entrepriseId, entrepriseId))
    .orderBy(desc(bordereaux.createdAt))
    .limit(5);
  const comptes = recentes.length
    ? await db
        .select({ bordereauId: lignesBordereau.bordereauId, n: sql<number>`count(*)::int` })
        .from(lignesBordereau)
        .where(inArray(lignesBordereau.bordereauId, recentes.map((r) => r.id)))
        .groupBy(lignesBordereau.bordereauId)
    : [];
  const collectes = recentes.map((r) => ({
    id: r.id,
    numero: r.numero,
    statut: r.statut,
    date: r.date,
    nombreArticles: comptes.find((c) => c.bordereauId === r.id)?.n ?? 0,
  }));

  const argent = await soldeEntreprise(db, entrepriseId);
  return { stock, ventes: { aujourdhui: bilan(debutJour), septJours: bilan(debut7) }, collectes, argent };
}

// Détail d'une collecte : seulement pour le commerçant concerné, sans identité du collecteur.
export async function detailCollecte(db: Db, user: AuthUser, id: string) {
  const [bd] = await db.select().from(bordereaux).where(eq(bordereaux.id, id)).limit(1);
  if (!bd || bd.entrepriseId !== user.entrepriseId) throw notFound('Collecte introuvable');
  const lignes = await db
    .select({ id: lignesBordereau.id, nomArticle: lignesBordereau.nomArticle, quantite: lignesBordereau.quantite, etat: lignesBordereau.etat, controle: lignesBordereau.controle, bloqueLivraison: lignesBordereau.bloqueLivraison })
    .from(lignesBordereau)
    .where(eq(lignesBordereau.bordereauId, id));
  return { id: bd.id, numero: bd.numero, statut: bd.statut, date: bd.createdAt, lignes };
}
