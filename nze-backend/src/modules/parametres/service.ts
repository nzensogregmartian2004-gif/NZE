// Paramètres versionnés : point fixe NZE et tarif de livraison. Chaque changement est daté.
import { desc, eq, lte } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import { entreprises, pointsFixes, reglages, tarifsLivraison } from '../../db/schema.ts';
import { badRequest, conflict } from '../../core/errors.ts';
import { assertFcfa } from '../../core/money.ts';
import { journaliser } from '../audit/service.ts';

// Message affiché quand le client choisit « payer sur place ». Il ne bloque jamais le paiement en ligne.
export const MESSAGE_PAIEMENT_SUR_PLACE =
  "Vous pouvez payer dès maintenant en ligne, par Airtel Money, Moov Money ou carte bancaire. " +
  "Votre livreur vous expliquera la procédure à la remise de votre commande.";

export async function pointFixeActif(db: Db, a: Date = new Date()) {
  const [p] = await db.select().from(pointsFixes).where(lte(pointsFixes.effetDebut, a)).orderBy(desc(pointsFixes.effetDebut)).limit(1);
  if (!p) throw conflict('Point fixe NZE non défini');
  return p;
}

export async function tarifActif(db: Db, a: Date = new Date()) {
  const [t] = await db.select().from(tarifsLivraison).where(lte(tarifsLivraison.effetDebut, a)).orderBy(desc(tarifsLivraison.effetDebut)).limit(1);
  if (!t) throw conflict('Tarif de livraison non défini');
  return t;
}

export async function definirPointFixe(db: Db, libelle: string, latitude: number, longitude: number, acteurId: string, effetDebut = new Date()) {
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) throw badRequest('Coordonnées invalides');
  // Le point et sa trace partent ensemble : sans journal, pas de point fixe.
  return db.transaction(async (tx) => {
    const [p] = await tx.insert(pointsFixes).values({ libelle, latitude, longitude, effetDebut }).returning();
    await journaliser(tx, { acteurId, action: 'POINT_FIXE_DEFINI', cibleType: 'point_fixe', cibleId: p.id, details: { latitude, longitude } });
    return p;
  });
}

export async function definirTarif(db: Db, fcfaParKm: number, minimumFcfa: number, acteurId: string, effetDebut = new Date()) {
  const km = assertFcfa(fcfaParKm, 'Tarif au kilomètre');
  const minimum = assertFcfa(minimumFcfa, 'Minimum de livraison');
  return db.transaction(async (tx) => {
    const [t] = await tx.insert(tarifsLivraison).values({ fcfaParKm: km, minimumFcfa: minimum, effetDebut }).returning();
    await journaliser(tx, { acteurId, action: 'TARIF_DEFINI', cibleType: 'tarif_livraison', cibleId: t.id, details: { fcfaParKm: km, minimumFcfa: minimum } });
    return t;
  });
}

// Origine de la distance : deux points seulement, l'origine et le client.
// Panier d'un seul commerçant ayant un emplacement : l'emplacement du commerçant. Sinon : le point fixe NZE.
export async function origineLivraison(db: Db, entrepriseIds: string[], a: Date = new Date()) {
  const uniques = [...new Set(entrepriseIds)];
  if (uniques.length === 1) {
    const [e] = await db.select({ latitude: entreprises.latitude, longitude: entreprises.longitude }).from(entreprises).where(eq(entreprises.id, uniques[0])).limit(1);
    if (e && e.latitude !== null && e.longitude !== null) {
      return { latitude: e.latitude, longitude: e.longitude, pointFixeId: null as string | null };
    }
  }
  const point = await pointFixeActif(db, a);
  return { latitude: point.latitude, longitude: point.longitude, pointFixeId: point.id as string | null };
}

// Message modifiable par l'administration (table des réglages). À défaut, le message par défaut.
export const CLE_MESSAGE_SUR_PLACE = 'paiement_sur_place_message';

export async function lireMessagePaiementSurPlace(db: Db): Promise<string> {
  const [r] = await db.select({ valeur: reglages.valeur }).from(reglages).where(eq(reglages.cle, CLE_MESSAGE_SUR_PLACE)).limit(1);
  return r?.valeur ?? MESSAGE_PAIEMENT_SUR_PLACE;
}

export async function modifierMessagePaiementSurPlace(db: Db, acteurId: string, message: string) {
  await db
    .insert(reglages)
    .values({ cle: CLE_MESSAGE_SUR_PLACE, valeur: message })
    .onConflictDoUpdate({ target: reglages.cle, set: { valeur: message } });
  await journaliser(db, { acteurId, action: 'REGLAGE_MODIFIE', cibleType: 'reglage', cibleId: CLE_MESSAGE_SUR_PLACE, details: { cle: CLE_MESSAGE_SUR_PLACE } });
  return { message };
}
