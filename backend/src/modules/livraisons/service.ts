import type { Page } from '../../core/pagination.ts';
// Livraisons à domicile (révision 9, cahier §13 et §14.1). NZE confie une commande payée à un livreur.
// Preuve de remise : la signature papier confirmée par le livreur (le code OTP client a été retiré).
// Aucune livraison n'est clôturée sans les deux, ni avec un article bloqué par une anomalie de qualité.
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import { ADMIN_ROLES, type AuthUser } from '../../core/auth.ts';
import { AppError, badRequest, conflict, forbidden, notFound } from '../../core/errors.ts';
import { journaliser } from '../audit/service.ts';
import { notifier } from '../notifications/service.ts';
import { articleBloqueLivraison, listerBlocages } from '../collectes/service.ts';
import { bordereaux, commandes, lignesBordereau, lignesCommande, lignesLivraison, livraisons, produits, reglages, users } from '../../db/schema.ts';
import { distanceMetres } from './pricing.ts';

export const MOTIFS = ['LIVRAISON_COMMANDE', 'NOUVELLE_TENTATIVE', 'SECONDE_LIVRAISON'] as const;
export const MOTIFS_ECHEC = ['CLIENT_ABSENT', 'REFUS_CLIENT', 'ADRESSE_INTROUVABLE', 'AUTRE'] as const;
export const STATUTS = ['ASSIGNEE', 'EN_ROUTE', 'ARRIVE', 'LIVREE', 'PARTIELLE', 'ECHEC'] as const;
const ACTIFS: string[] = ['ASSIGNEE', 'EN_ROUTE', 'ARRIVE'];
// Position du livreur affichée au client : seulement si elle est récente.
const POSITION_MAX_AGE_MS = 2 * 60 * 1000;
export const CLE_SUIVI_GPS = 'suivi_gps_client';

// Gabon : UTC+1, sans heure d'été. Les bornes de jour et de mois suivent ce fuseau.
const DECALAGE_MS = 60 * 60 * 1000;
const debutJour = (d: Date): Date => {
  const l = new Date(d.getTime() + DECALAGE_MS);
  return new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate()) - DECALAGE_MS);
};
const debutMois = (d: Date): Date => {
  const l = new Date(d.getTime() + DECALAGE_MS);
  return new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), 1) - DECALAGE_MS);
};

export const formatReference = (numero: number, date: Date): string =>
  `LIV-${date.getUTCFullYear()}-${String(numero).padStart(6, '0')}`;

type LivraisonBase = typeof livraisons.$inferSelect;
type LigneBase = typeof lignesLivraison.$inferSelect;

function presenter(l: LivraisonBase, lignes: LigneBase[], commandeReference: string) {
  return {
    id: l.id,
    reference: formatReference(l.numero, l.createdAt),
    statut: l.statut,
    motif: l.motif,
    commandeId: l.commandeId,
    commandeReference,
    livreurId: l.livreurId,
    signaturePapierRecue: l.signaturePapierRecue,
    motifEchec: l.motifEchec,
    commentaire: l.commentaire,
    latitude: l.latitude,
    longitude: l.longitude,
    demarreeLe: l.demarreeLe,
    clotureeLe: l.clotureeLe,
    createdAt: l.createdAt,
    arriveLe: l.arriveLe,
    positionLivreur:
      ACTIFS.includes(l.statut) && l.livreurLatitude !== null && l.livreurLongitude !== null
        ? { latitude: l.livreurLatitude, longitude: l.livreurLongitude, miseAJourLe: l.livreurPositionLe }
        : null,
    lignes: lignes.map((x) => ({
      id: x.id,
      ligneCommandeId: x.ligneCommandeId,
      produitId: x.produitId,
      nomArticle: x.nomArticle,
      quantiteDemandee: x.quantiteDemandee,
      quantiteLivree: x.quantiteLivree,
      statutLigne: x.statutLigne,
    })),
  };
}

async function chargerLivraison(db: Db, id: string) {
  const [l] = await db.select().from(livraisons).where(eq(livraisons.id, id)).limit(1);
  if (!l) throw notFound('Livraison introuvable');
  const lignes = await db.select().from(lignesLivraison).where(eq(lignesLivraison.livraisonId, id));
  const [commande] = await db.select().from(commandes).where(eq(commandes.id, l.commandeId)).limit(1);
  return { l, lignes, commande };
}

// Quantités restant à livrer par article d'une commande (commande − déjà livré dans les livraisons LIVREE ou PARTIELLE).
export async function quantitesRestantes(db: Db, commandeId: string) {
  const lignes = await db
    .select({ id: lignesCommande.id, produitId: lignesCommande.produitId, quantite: lignesCommande.quantite, nomArticle: produits.nom })
    .from(lignesCommande)
    .innerJoin(produits, eq(produits.id, lignesCommande.produitId))
    .where(eq(lignesCommande.commandeId, commandeId));
  const livrees = await db
    .select({ ligneCommandeId: lignesLivraison.ligneCommandeId, quantiteLivree: lignesLivraison.quantiteLivree })
    .from(lignesLivraison)
    .innerJoin(livraisons, eq(livraisons.id, lignesLivraison.livraisonId))
    .where(and(eq(livraisons.commandeId, commandeId), inArray(livraisons.statut, ['LIVREE', 'PARTIELLE'])));
  const dejaLivre = new Map<string, number>();
  for (const r of livrees) dejaLivre.set(r.ligneCommandeId, (dejaLivre.get(r.ligneCommandeId) ?? 0) + r.quantiteLivree);
  return lignes
    .map((l) => ({ ligneCommandeId: l.id, produitId: l.produitId, nomArticle: l.nomArticle, restant: l.quantite - (dejaLivre.get(l.id) ?? 0) }))
    .filter((l) => l.restant > 0);
}

export async function creerLivraison(db: Db, admin: AuthUser, b: { commandeId: string; livreurId: string; motif: (typeof MOTIFS)[number] }) {
  const [commande] = await db.select().from(commandes).where(eq(commandes.id, b.commandeId)).limit(1);
  if (!commande) throw notFound('Commande introuvable');
  if (commande.statut !== 'PAYEE') throw conflict('La commande doit être payée avant d’être confiée à un livreur');
  if (commande.reception !== 'LIVRAISON') throw badRequest('Cette commande est en retrait, pas en livraison');

  const [livreur] = await db.select({ role: users.role }).from(users).where(eq(users.id, b.livreurId)).limit(1);
  if (!livreur || livreur.role !== 'livreur') throw badRequest('Le destinataire n’est pas un livreur NZE');

  const precedentes = (await db.select({ statut: livraisons.statut }).from(livraisons).where(eq(livraisons.commandeId, b.commandeId))).map((p) => p.statut);
  if (precedentes.some((s) => ACTIFS.includes(s))) throw conflict('Une livraison est déjà en cours pour cette commande');
  switch (b.motif) {
    case 'LIVRAISON_COMMANDE':
      if (precedentes.length > 0) throw conflict('Une livraison existe déjà : utilisez NOUVELLE_TENTATIVE ou SECONDE_LIVRAISON');
      break;
    case 'NOUVELLE_TENTATIVE':
      if (!precedentes.includes('ECHEC') || precedentes.includes('PARTIELLE')) throw conflict('Une nouvelle tentative suit un échec, sans livraison partielle');
      break;
    case 'SECONDE_LIVRAISON':
      if (!precedentes.includes('PARTIELLE')) throw conflict('Une seconde livraison suit une livraison partielle');
      break;
  }

  const restants = await quantitesRestantes(db, b.commandeId);
  if (restants.length === 0) throw conflict('Tous les articles de cette commande sont déjà livrés');
  for (const r of restants) {
    if (await articleBloqueLivraison(db, r.produitId)) {
      throw conflict(`Article bloqué par une anomalie de qualité : ${r.nomArticle}. Décision de NZE requise.`);
    }
  }

  const id = await db.transaction(async (tx) => {
    const [l] = await tx
      .insert(livraisons)
      .values({ commandeId: b.commandeId, livreurId: b.livreurId, assigneePar: admin.id, motif: b.motif, statut: 'ASSIGNEE' })
      .returning();
    await tx.insert(lignesLivraison).values(
      restants.map((r) => ({
        livraisonId: l.id,
        ligneCommandeId: r.ligneCommandeId,
        produitId: r.produitId,
        nomArticle: r.nomArticle,
        quantiteDemandee: r.restant,
      })),
    );
    await journaliser(tx, {
      acteurId: admin.id,
      action: 'LIVRAISON_CREEE',
      cibleType: 'livraison',
      cibleId: l.id,
      details: { motif: b.motif, livreurId: b.livreurId, articles: restants.length },
    });
    await notifier(tx, { destinataireId: commande.userId, type: 'LIVRAISON_AFFECTEE', titre: 'Votre commande est en route', message: 'Un livreur NZE a été affecté à votre commande. Le code de remise est disponible dans le suivi de la commande.', cibleType: 'livraison', cibleId: l.id });
    return l.id;
  });
  const { l, lignes, commande: c } = await chargerLivraison(db, id);
  return presenter(l, lignes, c.reference);
}

// Lecture : l'administration voit tout (sans code) ; le livreur voit ses livraisons, avec les coordonnées du client nécessaires à la remise.
export async function lireLivraison(db: Db, user: AuthUser, id: string) {
  const { l, lignes, commande } = await chargerLivraison(db, id);
  if (ADMIN_ROLES.includes(user.role)) return presenter(l, lignes, commande.reference);
  if (user.role === 'livreur' && user.id === l.livreurId) {
    const [client] = await db.select({ telephone: users.telephone, nomAffiche: users.nomAffiche }).from(users).where(eq(users.id, commande.userId)).limit(1);
    return {
      ...presenter(l, lignes, commande.reference),
      destination: {
        latitude: commande.latitude,
        longitude: commande.longitude,
        clientNom: client?.nomAffiche ?? null,
        clientTelephone: client?.telephone ?? null,
      },
    };
  }
  throw forbidden();
}

export async function listerLivraisons(db: Db, user: AuthUser, filtres: { statut?: string; livreurId?: string }, page: Page) {
  const conditions = [];
  if (user.role === 'livreur') {
    conditions.push(eq(livraisons.livreurId, user.id));
  } else if (ADMIN_ROLES.includes(user.role)) {
    if (filtres.statut) conditions.push(eq(livraisons.statut, filtres.statut));
    if (filtres.livreurId) conditions.push(eq(livraisons.livreurId, filtres.livreurId));
  } else {
    throw forbidden();
  }
  const rows = await db
    .select()
    .from(livraisons)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(livraisons.createdAt), desc(livraisons.id))
    .limit(page.limite)
    .offset(page.decalage);
  return rows.map((l) => ({
    id: l.id,
    reference: formatReference(l.numero, l.createdAt),
    statut: l.statut,
    motif: l.motif,
    commandeId: l.commandeId,
    livreurId: user.role === 'livreur' ? undefined : l.livreurId,
    createdAt: l.createdAt,
    clotureeLe: l.clotureeLe,
  }));
}

function verifierAssignation(livreur: AuthUser, l: LivraisonBase): void {
  if (livreur.id !== l.livreurId) throw forbidden();
  if (!ACTIFS.includes(l.statut)) throw conflict('Cette livraison n’est plus active');
}

export async function demarrerLivraison(db: Db, livreur: AuthUser, id: string) {
  const { l } = await chargerLivraison(db, id);
  verifierAssignation(livreur, l);
  if (l.statut !== 'ASSIGNEE') throw conflict('La livraison est déjà démarrée');
  await db.transaction(async (tx) => {
    await tx.update(livraisons).set({ statut: 'EN_ROUTE', demarreeLe: new Date() }).where(eq(livraisons.id, id));
    await journaliser(tx, { acteurId: livreur.id, action: 'LIVRAISON_DEMARREE', cibleType: 'livraison', cibleId: id, details: {} });
  });
  return lireLivraison(db, livreur, id);
}

export async function confirmerLivraison(
  db: Db,
  livreur: AuthUser,
  id: string,
  b: {
    signaturePapierRecue: true;
    lignes: { ligneId: string; quantiteLivree: number }[];
    commentaire?: string;
    latitude?: number;
    longitude?: number;
  },
) {
  const { l, lignes, commande } = await chargerLivraison(db, id);
  verifierAssignation(livreur, l);

  const recues = new Map(b.lignes.map((x) => [x.ligneId, x.quantiteLivree]));
  const idsLivraison = new Set(lignes.map((x) => x.id));
  if (recues.size !== b.lignes.length || lignes.some((x) => !recues.has(x.id)) || b.lignes.some((x) => !idsLivraison.has(x.ligneId))) {
    throw badRequest('Chaque article de la livraison doit être renseigné une fois');
  }
  for (const ligne of lignes) {
    const q = recues.get(ligne.id) ?? 0;
    if (q > ligne.quantiteDemandee) throw badRequest(`Quantité livrée supérieure à la demande : ${ligne.nomArticle}`);
    if (q > 0 && (await articleBloqueLivraison(db, ligne.produitId))) {
      throw conflict(`Article bloqué par une anomalie de qualité : ${ligne.nomArticle}. Livraison impossible.`);
    }
  }
  const total = lignes.reduce((somme, x) => somme + (recues.get(x.id) ?? 0), 0);
  if (total === 0) throw badRequest('Aucun article livré : déclarez un échec de livraison');
  const complete = lignes.every((x) => recues.get(x.id) === x.quantiteDemandee);
  const statut = complete ? 'LIVREE' : 'PARTIELLE';

  await db.transaction(async (tx) => {
    await tx
      .update(livraisons)
      .set({
        statut,
        signaturePapierRecue: true,
        commentaire: b.commentaire ?? null,
        latitude: b.latitude ?? null,
        longitude: b.longitude ?? null,
        livreurLatitude: null,
        livreurLongitude: null,
        livreurPositionLe: null,
        clotureeLe: new Date(),
      })
      .where(eq(livraisons.id, id));
    for (const ligne of lignes) {
      const q = recues.get(ligne.id) ?? 0;
      const statutLigne = q === ligne.quantiteDemandee ? 'LIVREE' : q === 0 ? 'NON_LIVREE' : 'PARTIELLE';
      await tx.update(lignesLivraison).set({ quantiteLivree: q, statutLigne }).where(eq(lignesLivraison.id, ligne.id));
    }
    await journaliser(tx, {
      acteurId: livreur.id,
      action: 'LIVRAISON_CONFIRMEE',
      cibleType: 'livraison',
      cibleId: id,
      details: { statut, quantiteLivree: total, articles: lignes.length },
    });
    await notifier(
      tx,
      statut === 'LIVREE'
        ? { destinataireId: commande.userId, type: 'LIVRAISON_CONFIRMEE', titre: 'Commande livrée', message: 'Votre commande a été remise. Merci de votre confiance.', cibleType: 'livraison', cibleId: id }
        : { destinataireId: commande.userId, type: 'LIVRAISON_PARTIELLE', titre: 'Livraison partielle', message: 'Une partie de votre commande a été remise. Le reste sera livré prochainement.', cibleType: 'livraison', cibleId: id },
    );
  });
  return lireLivraison(db, livreur, id);
}

export async function signalerEchec(
  db: Db,
  livreur: AuthUser,
  id: string,
  b: { motif: (typeof MOTIFS_ECHEC)[number]; commentaire?: string; latitude?: number; longitude?: number },
) {
  const { l, commande } = await chargerLivraison(db, id);
  verifierAssignation(livreur, l);
  await db.transaction(async (tx) => {
    await tx
      .update(livraisons)
      .set({
        statut: 'ECHEC',
        motifEchec: b.motif,
        commentaire: b.commentaire ?? null,
        latitude: b.latitude ?? null,
        longitude: b.longitude ?? null,
        livreurLatitude: null,
        livreurLongitude: null,
        livreurPositionLe: null,
        clotureeLe: new Date(),
      })
      .where(eq(livraisons.id, id));
    await tx.update(lignesLivraison).set({ statutLigne: 'NON_LIVREE' }).where(eq(lignesLivraison.livraisonId, id));
    await journaliser(tx, { acteurId: livreur.id, action: 'LIVRAISON_ECHEC', cibleType: 'livraison', cibleId: id, details: { motif: b.motif } });
    await notifier(tx, { destinataireId: commande.userId, type: 'LIVRAISON_ECHEC', titre: 'Livraison non effectuée', message: 'Votre commande n’a pas pu être remise. NZE vous contactera pour une nouvelle tentative.', cibleType: 'livraison', cibleId: id });
  });
  return lireLivraison(db, livreur, id);
}

// Réaffectation par NZE (erreur d'affectation, livreur indisponible). Le code reste le même : le client ne le change pas.
export async function reassigner(db: Db, admin: AuthUser, id: string, livreurId: string) {
  const { l } = await chargerLivraison(db, id);
  if (!ACTIFS.includes(l.statut)) throw conflict('Seule une livraison active peut être réaffectée');
  const [livreur] = await db.select({ role: users.role }).from(users).where(eq(users.id, livreurId)).limit(1);
  if (!livreur || livreur.role !== 'livreur') throw badRequest('Le destinataire n’est pas un livreur NZE');
  await db.transaction(async (tx) => {
    await tx
      .update(livraisons)
      .set({ livreurId, statut: 'ASSIGNEE', demarreeLe: null, arriveLe: null, livreurLatitude: null, livreurLongitude: null, livreurPositionLe: null })
      .where(eq(livraisons.id, id));
    await journaliser(tx, {
      acteurId: admin.id,
      action: 'LIVRAISON_REASSIGNEE',
      cibleType: 'livraison',
      cibleId: id,
      details: { ancienLivreurId: l.livreurId, nouveauLivreurId: livreurId },
    });
  });
  const { l: maj, lignes, commande } = await chargerLivraison(db, id);
  return presenter(maj, lignes, commande.reference);
}

// Suivi pour le client : statut, historique et code de remise, seulement pendant la livraison active.
// La position du livreur n'est montrée que si NZE a activé le suivi GPS et si elle est récente.
export async function suiviClient(db: Db, userId: string, commandeId: string) {
  const [c] = await db.select().from(commandes).where(and(eq(commandes.id, commandeId), eq(commandes.userId, userId))).limit(1);
  if (!c) throw notFound('Commande introuvable');
  const rows = await db.select().from(livraisons).where(eq(livraisons.commandeId, commandeId)).orderBy(desc(livraisons.createdAt));
  const active = rows.find((r) => ACTIFS.includes(r.statut));
  const suiviActif = await suiviGpsActif(db);
  const positionFraiche =
    !!active &&
    suiviActif &&
    active.livreurLatitude !== null &&
    active.livreurLongitude !== null &&
    !!active.livreurPositionLe &&
    Date.now() - active.livreurPositionLe.getTime() <= POSITION_MAX_AGE_MS;
  return {
    commandeReference: c.reference,
    statutActif: active?.statut ?? null,
    positionLivreur: positionFraiche
      ? { latitude: active!.livreurLatitude, longitude: active!.livreurLongitude, miseAJourLe: active!.livreurPositionLe }
      : null,
    historique: rows.map((r) => ({
      reference: formatReference(r.numero, r.createdAt),
      statut: r.statut,
      motif: r.motif,
      clotureeLe: r.clotureeLe,
    })),
  };
}

// Vue partenaire : seulement les articles de son entreprise. Ni client, ni livreur, ni code.
// Pagination par livraison (et non par ligne) : une livraison n'apparaît jamais à moitié.
export async function livraisonsPourPartenaire(db: Db, entrepriseId: string, page: Page) {
  const ids = await db
    .selectDistinct({ id: livraisons.id, createdAt: livraisons.createdAt })
    .from(lignesLivraison)
    .innerJoin(livraisons, eq(livraisons.id, lignesLivraison.livraisonId))
    .innerJoin(lignesCommande, eq(lignesCommande.id, lignesLivraison.ligneCommandeId))
    .where(eq(lignesCommande.entrepriseId, entrepriseId))
    .orderBy(desc(livraisons.createdAt), desc(livraisons.id))
    .limit(page.limite)
    .offset(page.decalage);
  if (ids.length === 0) return [];
  const rows = await db
    .select({
      livraisonId: livraisons.id,
      numero: livraisons.numero,
      statut: livraisons.statut,
      createdAt: livraisons.createdAt,
      clotureeLe: livraisons.clotureeLe,
      ligneId: lignesLivraison.id,
      nomArticle: lignesLivraison.nomArticle,
      quantiteDemandee: lignesLivraison.quantiteDemandee,
      quantiteLivree: lignesLivraison.quantiteLivree,
      statutLigne: lignesLivraison.statutLigne,
    })
    .from(lignesLivraison)
    .innerJoin(livraisons, eq(livraisons.id, lignesLivraison.livraisonId))
    .innerJoin(lignesCommande, eq(lignesCommande.id, lignesLivraison.ligneCommandeId))
    .where(and(eq(lignesCommande.entrepriseId, entrepriseId), inArray(livraisons.id, ids.map((i) => i.id))))
    .orderBy(desc(livraisons.createdAt), desc(livraisons.id));
  const parLivraison = new Map<string, { id: string; reference: string; statut: string; clotureeLe: Date | null; lignes: object[] }>();
  for (const r of rows) {
    let entree = parLivraison.get(r.livraisonId);
    if (!entree) {
      entree = { id: r.livraisonId, reference: formatReference(r.numero, r.createdAt), statut: r.statut, clotureeLe: r.clotureeLe, lignes: [] };
      parLivraison.set(r.livraisonId, entree);
    }
    entree.lignes.push({ id: r.ligneId, nomArticle: r.nomArticle, quantiteDemandee: r.quantiteDemandee, quantiteLivree: r.quantiteLivree, statutLigne: r.statutLigne });
  }
  return ids.map((i) => parLivraison.get(i.id)).filter((x): x is NonNullable<typeof x> => !!x);
}

// Tableaux de bord. Trois vues : livreur, administration, partenaire.
// Les chiffres sont calculés en base (agrégats) : aucune liste n'est chargée en mémoire pour les compter.
export async function tableauLivreur(db: Db, livreurId: string) {
  const maintenant = new Date();
  const jour = debutJour(maintenant);
  const mois = debutMois(maintenant);
  const [r] = await db
    .select({
      aFaire: sql<number>`count(*) filter (where ${livraisons.statut} = 'ASSIGNEE')::int`,
      enCours: sql<number>`count(*) filter (where ${livraisons.statut} in ('EN_ROUTE', 'ARRIVE'))::int`,
      livreesAujourdhui: sql<number>`count(*) filter (where ${livraisons.statut} = 'LIVREE' and ${livraisons.clotureeLe} >= ${jour})::int`,
      livreesMois: sql<number>`count(*) filter (where ${livraisons.statut} = 'LIVREE' and ${livraisons.clotureeLe} >= ${mois})::int`,
      partiellesMois: sql<number>`count(*) filter (where ${livraisons.statut} = 'PARTIELLE' and ${livraisons.clotureeLe} >= ${mois})::int`,
      echecsMois: sql<number>`count(*) filter (where ${livraisons.statut} = 'ECHEC' and ${livraisons.clotureeLe} >= ${mois})::int`,
    })
    .from(livraisons)
    .where(eq(livraisons.livreurId, livreurId));
  return {
    aFaire: r.aFaire,
    enCours: r.enCours,
    livreesAujourdhui: r.livreesAujourdhui,
    livreesMois: r.livreesMois,
    partiellesMois: r.partiellesMois,
    echecsMois: r.echecsMois,
  };
}

export async function tableauAdministration(db: Db) {
  const mois = debutMois(new Date());
  const parStatutRows = await db
    .select({ statut: livraisons.statut, nombre: sql<number>`count(*)::int` })
    .from(livraisons)
    .groupBy(livraisons.statut);
  const parStatut: Record<string, number> = {};
  for (const s of STATUTS) parStatut[s] = 0;
  for (const r of parStatutRows) parStatut[r.statut] = r.nombre;

  const [{ aReprendre }] = await db
    .select({ aReprendre: sql<number>`count(*)::int` })
    .from(livraisons)
    .where(and(inArray(livraisons.statut, ['ECHEC', 'PARTIELLE']), sql`${livraisons.clotureeLe} >= ${mois}`));

  const [{ blocagesOuverts }] = await db
    .select({ blocagesOuverts: sql<number>`count(*)::int` })
    .from(lignesBordereau)
    .innerJoin(bordereaux, eq(bordereaux.id, lignesBordereau.bordereauId))
    .where(eq(lignesBordereau.bloqueLivraison, true));

  // Compteurs du mois par livreur, puis tous les livreurs ayant au moins une livraison (même à zéro).
  const compteurs = await db
    .select({
      livreurId: livraisons.livreurId,
      livreesMois: sql<number>`count(*) filter (where ${livraisons.statut} = 'LIVREE')::int`,
      partiellesMois: sql<number>`count(*) filter (where ${livraisons.statut} = 'PARTIELLE')::int`,
      echecsMois: sql<number>`count(*) filter (where ${livraisons.statut} = 'ECHEC')::int`,
    })
    .from(livraisons)
    .where(sql`${livraisons.clotureeLe} >= ${mois}`)
    .groupBy(livraisons.livreurId);
  const idsRows = await db.selectDistinct({ livreurId: livraisons.livreurId }).from(livraisons);
  const idsLivreurs = idsRows.map((r) => r.livreurId);
  const noms = idsLivreurs.length
    ? await db.select({ id: users.id, nomAffiche: users.nomAffiche, telephone: users.telephone }).from(users).where(inArray(users.id, idsLivreurs))
    : [];
  const parLivreur = idsLivreurs.map((id) => {
    const c = compteurs.find((x) => x.livreurId === id);
    const u = noms.find((n) => n.id === id);
    return {
      livreurId: id,
      nom: u?.nomAffiche ?? u?.telephone ?? null,
      livreesMois: c?.livreesMois ?? 0,
      partiellesMois: c?.partiellesMois ?? 0,
      echecsMois: c?.echecsMois ?? 0,
    };
  });

  return { parStatut, aReprendre, blocagesOuverts, parLivreur };
}

export async function tableauPartenaire(db: Db, entrepriseId: string) {
  const parStatutLigne: Record<string, number> = { EN_ATTENTE: 0, LIVREE: 0, PARTIELLE: 0, NON_LIVREE: 0 };
  const lignes = await db
    .select({ statutLigne: lignesLivraison.statutLigne, nombre: sql<number>`count(*)::int` })
    .from(lignesLivraison)
    .innerJoin(livraisons, eq(livraisons.id, lignesLivraison.livraisonId))
    .innerJoin(lignesCommande, eq(lignesCommande.id, lignesLivraison.ligneCommandeId))
    .where(eq(lignesCommande.entrepriseId, entrepriseId))
    .groupBy(lignesLivraison.statutLigne);
  for (const l of lignes) parStatutLigne[l.statutLigne] = (parStatutLigne[l.statutLigne] ?? 0) + l.nombre;

  const [{ livraisonsActives }] = await db
    .select({ livraisonsActives: sql<number>`count(distinct ${livraisons.id})::int` })
    .from(lignesLivraison)
    .innerJoin(livraisons, eq(livraisons.id, lignesLivraison.livraisonId))
    .innerJoin(lignesCommande, eq(lignesCommande.id, lignesLivraison.ligneCommandeId))
    .where(and(eq(lignesCommande.entrepriseId, entrepriseId), inArray(livraisons.statut, ACTIFS)));

  const [{ articlesBloques, bordereauxAnomalie }] = await db
    .select({
      articlesBloques: sql<number>`count(${lignesBordereau.id})::int`,
      bordereauxAnomalie: sql<number>`count(distinct ${bordereaux.id})::int`,
    })
    .from(lignesBordereau)
    .innerJoin(bordereaux, eq(bordereaux.id, lignesBordereau.bordereauId))
    .where(and(eq(bordereaux.entrepriseId, entrepriseId), eq(lignesBordereau.bloqueLivraison, true)));

  return { livraisonsActives, lignesParStatut: parStatutLigne, articlesBloques, bordereauxAnomalie };
}

// Le livreur signale son arrivée chez le client. Il doit être en route.
export async function arriverLivraison(db: Db, livreur: AuthUser, id: string) {
  const { l, commande } = await chargerLivraison(db, id);
  verifierAssignation(livreur, l);
  if (l.statut !== 'EN_ROUTE') throw conflict('Le livreur doit être en route pour signaler son arrivée');
  await db.transaction(async (tx) => {
    await tx.update(livraisons).set({ statut: 'ARRIVE', arriveLe: new Date() }).where(eq(livraisons.id, id));
    await journaliser(tx, { acteurId: livreur.id, action: 'LIVREUR_ARRIVE', cibleType: 'livraison', cibleId: id, details: {} });
    await notifier(tx, { destinataireId: commande.userId, type: 'LIVREUR_ARRIVE', titre: 'Votre livreur est arrivé', message: 'Préparez le code de remise affiché dans le suivi de votre commande.', cibleType: 'livraison', cibleId: id });
  });
  return lireLivraison(db, livreur, id);
}

// Position du livreur pendant la mission. Non journalisée : elle est fréquente, et seule la dernière position est gardée.
// La distance indiquée est à vol d'oiseau : indicative, la distance routière viendra du fournisseur cartographique.
export async function enregistrerPosition(db: Db, livreur: AuthUser, id: string, p: { latitude: number; longitude: number }) {
  const { l, commande } = await chargerLivraison(db, id);
  verifierAssignation(livreur, l);
  if (l.statut === 'ASSIGNEE') throw conflict('Démarrez la livraison avant de partager la position');
  if (!(await suiviGpsActif(db))) throw new AppError(409, 'SUIVI_GPS_DESACTIVE', 'Le suivi GPS n’est pas activé par NZE');
  const maintenant = new Date();
  await db
    .update(livraisons)
    .set({ livreurLatitude: p.latitude, livreurLongitude: p.longitude, livreurPositionLe: maintenant })
    .where(eq(livraisons.id, id));
  const distanceVolOiseauM =
    commande.latitude !== null && commande.longitude !== null
      ? distanceMetres(p, { latitude: commande.latitude, longitude: commande.longitude })
      : null;
  return { livraisonId: id, miseAJourLe: maintenant, distanceVolOiseauM };
}

export async function suiviGpsActif(db: Db): Promise<boolean> {
  const [r] = await db.select({ valeur: reglages.valeur }).from(reglages).where(eq(reglages.cle, CLE_SUIVI_GPS)).limit(1);
  return r?.valeur === 'ACTIF';
}

export async function lireSuiviGps(db: Db) {
  return { actif: await suiviGpsActif(db) };
}

// Activation du suivi GPS par NZE (paramètre sensible : administrateur principal, journalisé).
export async function definirSuiviGps(db: Db, admin: AuthUser, actif: boolean) {
  const valeur = actif ? 'ACTIF' : 'INACTIF';
  await db.transaction(async (tx) => {
    await tx
      .insert(reglages)
      .values({ cle: CLE_SUIVI_GPS, valeur, acteurId: admin.id, misAJourLe: new Date() })
      .onConflictDoUpdate({ target: reglages.cle, set: { valeur, acteurId: admin.id, misAJourLe: new Date() } });
    await journaliser(tx, { acteurId: admin.id, action: 'SUIVI_GPS_DEFINI', cibleType: 'reglage', cibleId: CLE_SUIVI_GPS, details: { actif } });
  });
  return { actif };
}
