// Catalogue public et gestion administrative des produits.
import { and, asc, desc, eq, gt, gte, ilike, lte, sql } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import { categories, entreprises, etablissements, produits, promotions, stockNiveaux } from '../../db/schema.ts';
import { assertFcfa } from '../../core/money.ts';
import { AppError, notFound } from '../../core/errors.ts';
import type { AuthUser } from '../../core/auth.ts';
import { journaliser } from '../audit/service.ts';
import { SEUIL_STOCK_FAIBLE } from '../stock/service.ts';
export { SEUIL_STOCK_FAIBLE };

// Vue client : le vendeur affiché est toujours NZE, jamais l'entreprise partenaire.
export type TriProduits = 'nom' | 'prix-croissant' | 'prix-decroissant';

// Pagination du catalogue : taille par défaut et plafond par page. Plus de limite globale à 100 :
// on parcourt les pages avec « décalage ». Le tri inclut l'identifiant, pour que l'ordre reste stable d'une page à l'autre.
export const PAGE_DEFAUT = 24;
export const PAGE_MAX = 100;

export async function listerProduits(
  db: Db,
  filtres: { q?: string; categorie?: string; enStock?: boolean; prixMin?: number; prixMax?: number; tri?: TriProduits; limite?: number; decalage?: number },
) {
  const conditions = [eq(produits.statut, 'PUBLIE')];
  if (filtres.q) conditions.push(ilike(produits.nom, `%${filtres.q.replace(/[%_]/g, '')}%`));
  if (filtres.categorie) {
    const [cat] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, filtres.categorie)).limit(1);
    if (!cat) return [];
    conditions.push(eq(produits.categorieId, cat.id));
  }
  // « En stock » : quantité vendable (disponible moins réservée) positive ET état DISPONIBLE (cahier V3.0 §10.2).
  if (filtres.enStock) conditions.push(gt(sql`(${stockNiveaux.disponible} - ${stockNiveaux.reserve})`, 0), eq(stockNiveaux.etat, 'DISPONIBLE'));
  if (filtres.prixMin !== undefined) conditions.push(gte(produits.prixFcfa, filtres.prixMin));
  if (filtres.prixMax !== undefined) conditions.push(lte(produits.prixFcfa, filtres.prixMax));
  const ordre =
    filtres.tri === 'prix-croissant' ? [asc(produits.prixFcfa), asc(produits.nom), asc(produits.id)] :
    filtres.tri === 'prix-decroissant' ? [desc(produits.prixFcfa), asc(produits.nom), asc(produits.id)] :
    [asc(produits.nom), asc(produits.id)];
  const limite = Math.min(Math.max(filtres.limite ?? PAGE_DEFAUT, 1), PAGE_MAX);
  const decalage = Math.max(filtres.decalage ?? 0, 0);
  const rows = await db
    .select({
      id: produits.id,
      nom: produits.nom,
      prixFcfa: produits.prixFcfa,
      garantieJours: produits.garantieJours,
      aPhoto: sql<boolean>`${produits.photoCle} is not null`,
      disponible: stockNiveaux.disponible,
      reserve: stockNiveaux.reserve,
      etat: stockNiveaux.etat,
    })
    .from(produits)
    .leftJoin(stockNiveaux, eq(stockNiveaux.produitId, produits.id))
    .where(and(...conditions))
    .orderBy(...ordre)
    .limit(limite)
    .offset(decalage);
  return rows.map(({ disponible, reserve, etat, ...p }) => ({ ...p, enStock: (disponible ?? 0) - (reserve ?? 0) > 0 && etat === 'DISPONIBLE' }));
}

export async function detaillerProduit(db: Db, id: string) {
  const [p] = await db
    .select({
      id: produits.id,
      nom: produits.nom,
      description: produits.description,
      prixFcfa: produits.prixFcfa,
      garantieJours: produits.garantieJours,
      statut: produits.statut,
      disponible: stockNiveaux.disponible,
      reserve: stockNiveaux.reserve,
      caracteristiques: produits.caracteristiques,
      photos: produits.photos,
      commentaires: produits.commentaires,
    })
    .from(produits)
    .leftJoin(stockNiveaux, eq(stockNiveaux.produitId, produits.id))
    .where(eq(produits.id, id))
    .limit(1);
  if (!p || p.statut !== 'PUBLIE') throw notFound('Produit introuvable');
  const { disponible, reserve, statut, ...publique } = p;
  const quantite = Math.max(0, (disponible ?? 0) - (reserve ?? 0));
  return { ...publique, quantiteDisponible: quantite, enStock: quantite > 0, etatStock: etatStock(quantite) };
}

// Seuil d'alerte : en dessous, le client voit « stock faible ».
export function etatStock(quantite: number): 'RUPTURE' | 'STOCK_FAIBLE' | 'EN_STOCK' {
  if (quantite <= 0) return 'RUPTURE';
  if (quantite <= SEUIL_STOCK_FAIBLE) return 'STOCK_FAIBLE';
  return 'EN_STOCK';
}

export async function listerEntreprises(db: Db) {
  return db.select({ id: entreprises.id, nom: entreprises.nom, statutPartenariat: entreprises.statutPartenariat }).from(entreprises).orderBy(entreprises.nom);
}

export async function creerEntreprise(db: Db, nom: string) {
  const [e] = await db.insert(entreprises).values({ nom }).returning();
  return e;
}

export async function creerEtablissement(db: Db, entrepriseId: string, nom: string, adresse?: string) {
  const [e] = await db.insert(etablissements).values({ entrepriseId, nom, adresse }).returning();
  return e;
}

export async function creerCategorie(db: Db, nom: string, slug: string) {
  const [c] = await db.insert(categories).values({ nom, slug }).returning();
  return c;
}

export async function creerProduit(
  db: Db,
  data: { entrepriseId: string; etablissementId?: string; categorieId?: string; nom: string; marque?: string; modele?: string; description?: string; prixFcfa: number; garantieJours?: number; statut?: 'BROUILLON' | 'PUBLIE' | 'SUSPENDU'; caracteristiques?: { nom: string; valeur: string }[]; photos?: string[]; commentaires?: string },
) {
  const prix = assertFcfa(data.prixFcfa, 'Prix');
  return db.transaction(async (tx) => {
    const [p] = await tx.insert(produits).values({ ...data, prixFcfa: prix }).returning();
    await tx.insert(stockNiveaux).values({ produitId: p.id, disponible: 0, reserve: 0 });
    return p;
  });
}

export async function modifierProduit(db: Db, id: string, changements: { nom?: string; marque?: string; modele?: string; description?: string; garantieJours?: number; prixFcfa?: number; statut?: 'BROUILLON' | 'PUBLIE' | 'SUSPENDU'; caracteristiques?: { nom: string; valeur: string }[]; photos?: string[]; commentaires?: string }) {
  const set: Record<string, unknown> = {};
  if (changements.prixFcfa !== undefined) set.prixFcfa = assertFcfa(changements.prixFcfa, 'Prix');
  if (changements.statut !== undefined) set.statut = changements.statut;
  if (changements.nom !== undefined) set.nom = changements.nom;
  if (changements.marque !== undefined) set.marque = changements.marque;
  if (changements.modele !== undefined) set.modele = changements.modele;
  if (changements.description !== undefined) set.description = changements.description;
  if (changements.garantieJours !== undefined) set.garantieJours = changements.garantieJours;
  if (changements.caracteristiques !== undefined) set.caracteristiques = changements.caracteristiques;
  if (changements.photos !== undefined) set.photos = changements.photos;
  if (changements.commentaires !== undefined) set.commentaires = changements.commentaires;
  const [p] = await db.update(produits).set(set).where(eq(produits.id, id)).returning();
  if (!p) throw notFound('Produit introuvable');
  return p;
}

export const compterProduits = (db: Db) => db.select({ n: sql<number>`count(*)::int` }).from(produits);

// Identité et responsable de l'entreprise (cahier V3.0 §8.2). Le statut ne se modifie pas ici (voir entreprises/cycle.ts).
export async function modifierEntreprise(
  db: Db, id: string, acteurId: string,
  champs: { nom?: string; nomOfficiel?: string; responsableNom?: string; responsableRole?: string; responsableTelephone?: string; telephone?: string; email?: string },
) {
  return db.transaction(async (tx) => {
    const [e] = await tx.update(entreprises).set(champs).where(eq(entreprises.id, id)).returning();
    if (!e) throw notFound('Entreprise introuvable');
    await journaliser(tx, { acteurId, action: 'ENTREPRISE_MODIFIEE', cibleType: 'entreprise', cibleId: id, details: { champs: Object.keys(champs).join(',') } });
    return e;
  });
}

// Promotions en cours : celles dont la période contient le moment demandé. Prix après réduction en FCFA entiers.
export async function promotionsEnCours(db: Db, maintenant: Date = new Date()) {
  const lignes = await db
    .select({
      id: promotions.id,
      titre: promotions.titre,
      pourcentage: promotions.pourcentage,
      fin: promotions.fin,
      produitId: produits.id,
      produitNom: produits.nom,
      prixFcfa: produits.prixFcfa,
    })
    .from(promotions)
    .innerJoin(produits, eq(produits.id, promotions.produitId))
    .where(and(lte(promotions.debut, maintenant), gt(promotions.fin, maintenant)))
    .orderBy(asc(promotions.fin));
  return lignes.map(({ prixFcfa, ...l }) => ({
    ...l,
    prixAvantFcfa: prixFcfa,
    prixApresFcfa: Math.round((prixFcfa * (100 - l.pourcentage)) / 100),
  }));
}

// Dates saisies au format AAAA-MM-JJ, à l'heure de Libreville (UTC+1) : début à minuit, fin à 23 h 59.
export function debutDeJournee(texte: string): Date {
  return new Date(`${texte}T00:00:00+01:00`);
}
export function finDeJournee(texte: string): Date {
  return new Date(`${texte}T23:59:59+01:00`);
}

export async function listerPromotions(db: Db) {
  return db
    .select({
      id: promotions.id,
      titre: promotions.titre,
      pourcentage: promotions.pourcentage,
      debut: promotions.debut,
      fin: promotions.fin,
      produitId: produits.id,
      produitNom: produits.nom,
      prixFcfa: produits.prixFcfa,
    })
    .from(promotions)
    .innerJoin(produits, eq(produits.id, promotions.produitId))
    .orderBy(desc(promotions.debut));
}

export interface SaisiePromotion {
  produitId: string;
  titre: string;
  pourcentage: number;
  debut: string;
  fin: string;
}

export async function creerPromotion(db: Db, acteur: AuthUser, b: SaisiePromotion) {
  const [produit] = await db.select({ id: produits.id }).from(produits).where(eq(produits.id, b.produitId)).limit(1);
  if (!produit) throw notFound('Article introuvable');
  const debut = debutDeJournee(b.debut);
  const fin = finDeJournee(b.fin);
  if (fin.getTime() <= debut.getTime()) {
    throw new AppError(400, 'PERIODE_INVALIDE', 'La date de fin doit être après la date de début.');
  }
  const [row] = await db
    .insert(promotions)
    .values({ produitId: b.produitId, titre: b.titre, pourcentage: b.pourcentage, debut, fin })
    .returning();
  await journaliser(db, { acteurId: acteur.id, action: 'PROMOTION_CREEE', cibleType: 'promotion', cibleId: row.id, details: { produitId: b.produitId, pourcentage: b.pourcentage } });
  return row;
}

export async function modifierPromotion(db: Db, acteur: AuthUser, id: string, b: { titre?: string; pourcentage?: number; fin?: string; arreter?: boolean }) {
  const [actuelle] = await db.select().from(promotions).where(eq(promotions.id, id)).limit(1);
  if (!actuelle) throw notFound('Promotion introuvable');
  const valeurs: { titre?: string; pourcentage?: number; fin?: Date } = {};
  if (b.titre !== undefined) valeurs.titre = b.titre;
  if (b.pourcentage !== undefined) valeurs.pourcentage = b.pourcentage;
  if (b.arreter) valeurs.fin = new Date();
  else if (b.fin !== undefined) valeurs.fin = finDeJournee(b.fin);
  if (Object.keys(valeurs).length === 0) throw new AppError(400, 'RIEN_A_MODIFIER', 'Aucune modification demandée.');
  if (valeurs.fin && valeurs.fin.getTime() <= actuelle.debut.getTime()) {
    throw new AppError(400, 'PERIODE_INVALIDE', 'La promotion se terminerait avant de commencer.');
  }
  const [row] = await db.update(promotions).set(valeurs).where(eq(promotions.id, id)).returning();
  await journaliser(db, { acteurId: acteur.id, action: 'PROMOTION_MODIFIEE', cibleType: 'promotion', cibleId: id, details: { ...b } });
  return row;
}

export async function supprimerPromotion(db: Db, acteur: AuthUser, id: string) {
  const [row] = await db.delete(promotions).where(eq(promotions.id, id)).returning({ id: promotions.id });
  if (!row) throw notFound('Promotion introuvable');
  await journaliser(db, { acteurId: acteur.id, action: 'PROMOTION_SUPPRIMEE', cibleType: 'promotion', cibleId: id, details: {} });
  return { id };
}

