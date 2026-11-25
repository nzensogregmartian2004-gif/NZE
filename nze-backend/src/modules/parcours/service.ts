import type { Page } from '../../core/pagination.ts';
// Parcours client : catégories, profil, adresses, liste d'envies, achats à nouveau, panier.
import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import { adresses, categories, commandes, lignesCommande, listesEnvies, produits, stockNiveaux, users } from '../../db/schema.ts';
import { notFound } from '../../core/errors.ts';
import type { AuthUser } from '../../core/auth.ts';
import type { Cartographie } from '../cartographie/index.ts';
import { creerCommande, lireCommande, type DemandeCommande } from '../commandes/service.ts';

export const LANGUES = ['fr', 'en', 'ar', 'zh-Hans'] as const;

export async function listerCategories(db: Db) {
  return db.select({ id: categories.id, nom: categories.nom, slug: categories.slug }).from(categories).orderBy(categories.nom);
}

export async function lireProfil(db: Db, user: AuthUser) {
  const [u] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  if (!u) throw notFound('Compte introuvable');
  return { id: u.id, telephone: u.telephone, role: u.role, nomAffiche: u.nomAffiche, langue: u.langue, nom: u.nom, prenom: u.prenom, dateNaissance: u.dateNaissance };
}

export async function modifierProfil(db: Db, user: AuthUser, changements: { nomAffiche?: string; langue?: (typeof LANGUES)[number]; nom?: string; prenom?: string }) {
  const set: Partial<{ nomAffiche: string; langue: string; nom: string; prenom: string }> = {};
  if (changements.nomAffiche !== undefined) set.nomAffiche = changements.nomAffiche;
  if (changements.langue !== undefined) set.langue = changements.langue;
  if (changements.nom !== undefined) set.nom = changements.nom;
  if (changements.prenom !== undefined) set.prenom = changements.prenom;
  // Le nom affiché suit le prénom et le nom, dès que l'un des deux change.
  if (set.nom !== undefined || set.prenom !== undefined) {
    const [actuel] = await db.select({ nom: users.nom, prenom: users.prenom }).from(users).where(eq(users.id, user.id)).limit(1);
    const nom = set.nom ?? actuel?.nom ?? '';
    const prenom = set.prenom ?? actuel?.prenom ?? '';
    if (nom && prenom) set.nomAffiche = `${prenom} ${nom}`;
  }
  if (Object.keys(set).length > 0) await db.update(users).set(set).where(eq(users.id, user.id));
  return lireProfil(db, user);
}

export async function listerAdresses(db: Db, user: AuthUser) {
  return db.select().from(adresses).where(eq(adresses.userId, user.id)).orderBy(desc(adresses.createdAt));
}

export async function ajouterAdresse(db: Db, user: AuthUser, a: { libelle: string; quartier: string; repere?: string; batiment?: string; etage?: string; instructions?: string; latitude: number; longitude: number; photoCle?: string }) {
  const [row] = await db
    .insert(adresses)
    .values({ userId: user.id, libelle: a.libelle, quartier: a.quartier, repere: a.repere ?? null, batiment: a.batiment ?? null, etage: a.etage ?? null, instructions: a.instructions ?? null, latitude: a.latitude, longitude: a.longitude, photoCle: a.photoCle ?? null })
    .returning();
  return row;
}

export async function supprimerAdresse(db: Db, user: AuthUser, id: string) {
  const [row] = await db.delete(adresses).where(and(eq(adresses.id, id), eq(adresses.userId, user.id))).returning({ id: adresses.id });
  if (!row) throw notFound('Adresse introuvable');
  return { id };
}

export async function listerListeEnvies(db: Db, user: AuthUser) {
  return db
    .select({ produitId: produits.id, nom: produits.nom, prixFcfa: produits.prixFcfa, disponible: stockNiveaux.disponible, ajouteLe: listesEnvies.createdAt })
    .from(listesEnvies)
    .innerJoin(produits, eq(produits.id, listesEnvies.produitId))
    .leftJoin(stockNiveaux, eq(stockNiveaux.produitId, produits.id))
    .where(eq(listesEnvies.userId, user.id))
    .orderBy(desc(listesEnvies.createdAt));
}

export async function ajouterListeEnvies(db: Db, user: AuthUser, produitId: string) {
  const [p] = await db.select({ id: produits.id }).from(produits).where(and(eq(produits.id, produitId), eq(produits.statut, 'PUBLIE'))).limit(1);
  if (!p) throw notFound('Produit introuvable');
  await db.insert(listesEnvies).values({ userId: user.id, produitId }).onConflictDoNothing();
  return { produitId };
}

export async function retirerListeEnvies(db: Db, user: AuthUser, produitId: string) {
  await db.delete(listesEnvies).where(and(eq(listesEnvies.userId, user.id), eq(listesEnvies.produitId, produitId)));
  return { produitId };
}

// Achats à nouveau : les articles des commandes payées, du plus récent au plus ancien, sans doublon.
export async function achatsANouveau(db: Db, user: AuthUser) {
  const lignes = await db
    .select({ produitId: lignesCommande.produitId, payeLe: commandes.payeLe })
    .from(lignesCommande)
    .innerJoin(commandes, eq(commandes.id, lignesCommande.commandeId))
    .where(and(eq(commandes.userId, user.id), eq(commandes.statut, 'PAYEE')))
    .orderBy(desc(commandes.payeLe));
  const vus = new Map<string, Date | null>();
  for (const l of lignes) if (!vus.has(l.produitId)) vus.set(l.produitId, l.payeLe);
  const ids = [...vus.keys()];
  if (ids.length === 0) return [];
  const rangees = await db
    .select({ id: produits.id, nom: produits.nom, prixFcfa: produits.prixFcfa, statut: produits.statut, disponible: stockNiveaux.disponible })
    .from(produits)
    .leftJoin(stockNiveaux, eq(stockNiveaux.produitId, produits.id))
    .where(inArray(produits.id, ids));
  return ids.map((id) => {
    const p = rangees.find((r) => r.id === id);
    return { produitId: id, nom: p?.nom ?? '', prixFcfa: p?.prixFcfa ?? 0, enStock: (p?.disponible ?? 0) > 0 && p?.statut === 'PUBLIE', dernierAchat: vus.get(id) };
  });
}

// Panier : la commande en statut PANIER de ce client, s'il en existe une.
async function panierCourant(db: Db, user: AuthUser) {
  const [c] = await db
    .select({ id: commandes.id })
    .from(commandes)
    .where(and(eq(commandes.userId, user.id), eq(commandes.statut, 'PANIER')))
    .orderBy(desc(commandes.createdAt))
    .limit(1);
  return c ?? null;
}

export async function lirePanier(db: Db, user: AuthUser) {
  const c = await panierCourant(db, user);
  return c ? lireCommande(db, user, c.id) : null;
}

// Remplace le panier : la nouvelle version est créée d'abord, l'ancienne n'est annulée qu'ensuite.
// Ainsi, une erreur (commission manquante, article retiré) ne fait jamais perdre le panier existant.
export async function remplacerPanier(db: Db, user: AuthUser, demande: DemandeCommande | { lignes: [] }, cartographie: Cartographie) {
  const ancien = await panierCourant(db, user);
  if (demande.lignes.length === 0) {
    if (ancien) await db.update(commandes).set({ statut: 'ANNULEE' }).where(eq(commandes.id, ancien.id));
    return null;
  }
  const nouveau = await creerCommande(db, user, demande as DemandeCommande, cartographie);
  if (ancien) await db.update(commandes).set({ statut: 'ANNULEE' }).where(and(eq(commandes.id, ancien.id), ne(commandes.id, nouveau.id)));
  return lireCommande(db, user, nouveau.id);
}

// Administration : listes pour le suivi quotidien.
export async function listerCommandesAdmin(db: Db, statut: string | undefined, page: Page) {
  const q = db
    .select({ id: commandes.id, reference: commandes.reference, statut: commandes.statut, reception: commandes.reception, totalFcfa: commandes.totalFcfa, createdAt: commandes.createdAt, payeLe: commandes.payeLe })
    .from(commandes);
  return (statut ? q.where(eq(commandes.statut, statut)) : q).orderBy(desc(commandes.createdAt), desc(commandes.id)).limit(page.limite).offset(page.decalage);
}

export async function listerProduitsAdmin(db: Db, page: Page) {
  return db
    .select({ id: produits.id, nom: produits.nom, prixFcfa: produits.prixFcfa, statut: produits.statut, entrepriseId: produits.entrepriseId, disponible: stockNiveaux.disponible, reserve: stockNiveaux.reserve })
    .from(produits)
    .leftJoin(stockNiveaux, eq(stockNiveaux.produitId, produits.id))
    .orderBy(produits.nom, produits.id)
    .limit(page.limite)
    .offset(page.decalage);
}
