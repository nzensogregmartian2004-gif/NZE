import { entrerStockCollecte } from '../stock/service.ts';
import type { Page } from '../../core/pagination.ts';
// Collectes et bordereaux (cahier §12). Chaque collecte produit un bordereau numérique.
// Une anomalie de qualité bloque l'article concerné jusqu'à une décision de NZE (levée du blocage, journalisée).
import { and, desc, eq, inArray, notInArray } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import { ADMIN_ROLES, type AuthUser } from '../../core/auth.ts';
import { badRequest, conflict, forbidden, notFound } from '../../core/errors.ts';
import { bordereaux, etablissements, entreprises, lignesBordereau, lignesCommande, lignesLivraison, livraisons, produits, users, commandes } from '../../db/schema.ts';
import { notifier } from '../notifications/service.ts';
import { journaliser } from '../audit/service.ts';

export interface LigneCollecteEntree {
  produitId: string;
  ligneCommandeId: string;
  quantite: number;
  etat: string;
  accessoires?: string;
  testEffectue: boolean;
  resultatTest?: string;
  controle: 'CONFORME' | 'ANOMALIE';
  commentaire?: string;
}

export interface BordereauEntree {
  entrepriseId: string;
  etablissementId?: string;
  commentaire?: string;
  lignes: LigneCollecteEntree[];
}

type LigneBase = typeof lignesBordereau.$inferSelect;
type BordereauBase = typeof bordereaux.$inferSelect;

export const formatReference = (numero: number, date: Date): string =>
  `BDR-${date.getUTCFullYear()}-${String(numero).padStart(6, '0')}`;

function presenter(bd: BordereauBase, lignes: LigneBase[]) {
  return {
    id: bd.id,
    reference: formatReference(bd.numero, bd.createdAt),
    statut: bd.statut,
    entrepriseId: bd.entrepriseId,
    etablissementId: bd.etablissementId,
    collecteurId: bd.collecteurId,
    commentaire: bd.commentaire,
    partenaireConfirmePar: bd.partenaireConfirmePar,
    partenaireConfirmeLe: bd.partenaireConfirmeLe,
    contestePar: bd.contestePar,
    contesteLe: bd.contesteLe,
    motifContestation: bd.motifContestation,
    validePar: bd.validePar,
    valideLe: bd.valideLe,
    motifRefus: bd.motifRefus,
    createdAt: bd.createdAt,
    lignes: lignes.map((l) => ({
      id: l.id,
      produitId: l.produitId,
      ligneCommandeId: l.ligneCommandeId,
      nomArticle: l.nomArticle,
      quantite: l.quantite,
      etat: l.etat,
      accessoires: l.accessoires,
      testEffectue: l.testEffectue,
      resultatTest: l.resultatTest,
      controle: l.controle,
      commentaire: l.commentaire,
      bloqueLivraison: l.bloqueLivraison,
      motifLevee: l.motifLevee,
    })),
  };
}

async function chargerBordereau(db: Db, id: string) {
  const [bd] = await db.select().from(bordereaux).where(eq(bordereaux.id, id)).limit(1);
  if (!bd) throw notFound('Bordereau introuvable');
  const lignes = await db.select().from(lignesBordereau).where(eq(lignesBordereau.bordereauId, id));
  return { bd, lignes };
}

// Visibilité (cahier §12.4) : administrateurs tous ; partenaire, ses marchandises ; livreur, ses missions.
function verifierAcces(user: AuthUser, bd: BordereauBase): void {
  if (ADMIN_ROLES.includes(user.role)) return;
  if (user.role === 'partenaire' && user.entrepriseId === bd.entrepriseId) return;
  if (user.role === 'livreur' && user.id === bd.collecteurId) return;
  throw forbidden();
}

// Articles commandés et affectés à ce livreur, regroupables par magasin.
// Une ligne déjà signalée en collecte reste masquée tant que le bordereau n’a pas été refusé/annulé.
export async function listerArticlesARecuperer(db: Db, livreur: AuthUser) {
  const lignes = await db
    .select({
      ligneCommandeId: lignesCommande.id,
      produitId: produits.id,
      nomArticle: produits.nom,
      quantite: lignesLivraison.quantiteDemandee,
      livraisonId: livraisons.id,
      commandeId: livraisons.commandeId,
      commandeReference: commandes.reference,
      entrepriseId: entreprises.id,
      magasinId: etablissements.id,
      magasinNom: etablissements.nom,
      magasinAdresse: etablissements.adresse,
      entrepriseNom: entreprises.nom,
    })
    .from(lignesLivraison)
    .innerJoin(livraisons, eq(livraisons.id, lignesLivraison.livraisonId))
    .innerJoin(commandes, eq(commandes.id, livraisons.commandeId))
    .innerJoin(lignesCommande, eq(lignesCommande.id, lignesLivraison.ligneCommandeId))
    .innerJoin(produits, and(eq(produits.id, lignesLivraison.produitId), eq(produits.id, lignesCommande.produitId)))
    .innerJoin(entreprises, eq(entreprises.id, produits.entrepriseId))
    .leftJoin(etablissements, eq(etablissements.id, produits.etablissementId))
    .where(and(eq(livraisons.livreurId, livreur.id), eq(commandes.statut, 'PAYEE'), inArray(livraisons.statut, ['ASSIGNEE', 'EN_ROUTE', 'ARRIVE'])))
    .orderBy(desc(livraisons.createdAt));

  if (lignes.length === 0) return [];
  const dejaSignalees = await db
    .select({ ligneCommandeId: lignesBordereau.ligneCommandeId })
    .from(lignesBordereau)
    .innerJoin(bordereaux, eq(bordereaux.id, lignesBordereau.bordereauId))
    .where(and(inArray(lignesBordereau.ligneCommandeId, lignes.map((l) => l.ligneCommandeId)), notInArray(bordereaux.statut, ['REFUSE', 'ANNULE'])));
  const deja = new Set(dejaSignalees.map((x) => x.ligneCommandeId).filter((x): x is string => Boolean(x)));
  return lignes.filter((l) => !deja.has(l.ligneCommandeId));
}

export async function creerBordereau(db: Db, collecteur: AuthUser, b: BordereauEntree) {
  const lignesCommandeUniques = new Set(b.lignes.map((l) => l.ligneCommandeId).filter(Boolean));
  if (lignesCommandeUniques.size !== b.lignes.length) throw badRequest('Un même article de commande ne peut apparaître qu’une fois dans un bordereau.');
  const [entreprise] = await db.select({ id: entreprises.id }).from(entreprises).where(eq(entreprises.id, b.entrepriseId)).limit(1);
  if (!entreprise) throw notFound('Entreprise introuvable');

  if (b.etablissementId) {
    const [etab] = await db
      .select({ id: etablissements.id })
      .from(etablissements)
      .where(and(eq(etablissements.id, b.etablissementId), eq(etablissements.entrepriseId, b.entrepriseId)))
      .limit(1);
    if (!etab) throw badRequest("L'établissement n'appartient pas à cette entreprise");
  }

  const idsProduits = [...new Set(b.lignes.map((l) => l.produitId))];
  const produitsTrouves = await db.select().from(produits).where(inArray(produits.id, idsProduits));
  const parId = new Map(produitsTrouves.map((p) => [p.id, p]));
  if (collecteur.role === 'livreur' && produitsTrouves.some((p) => !p.etablissementId)) {
    throw badRequest('Le magasin doit être renseigné sur chaque article avant de confirmer sa récupération.');
  }
  const magasinsProduits = [...new Set(produitsTrouves.map((p) => p.etablissementId ?? 'SANS_MAGASIN'))];
  if (magasinsProduits.length > 1) throw badRequest('Un bordereau de collecte ne peut concerner qu’un seul magasin.');
  const etablissementId = b.etablissementId ?? produitsTrouves[0]?.etablissementId ?? null;
  if (produitsTrouves.some((p) => (p.etablissementId ?? null) !== etablissementId)) throw badRequest('Le magasin indiqué ne correspond pas aux articles sélectionnés.');
  if (etablissementId) {
    const [magasin] = await db.select({ id: etablissements.id }).from(etablissements).where(and(eq(etablissements.id, etablissementId), eq(etablissements.entrepriseId, b.entrepriseId))).limit(1);
    if (!magasin) throw badRequest('Le magasin associé aux articles ne correspond pas au commerçant.');
  }
  for (const ligne of b.lignes) {
    const produit = parId.get(ligne.produitId);
    if (!produit || produit.entrepriseId !== b.entrepriseId) {
      throw badRequest(`Article absent de cette entreprise : ${ligne.produitId}`);
    }
    if (!ligne.ligneCommandeId) throw badRequest('Chaque article récupéré doit être rattaché à une ligne de commande.');
    const [lc] = await db.select().from(lignesCommande).where(eq(lignesCommande.id, ligne.ligneCommandeId)).limit(1);
    if (!lc || lc.produitId !== ligne.produitId || lc.entrepriseId !== b.entrepriseId) {
      throw badRequest(`Ligne de commande incohérente avec l'article : ${ligne.ligneCommandeId}`);
    }
    if (collecteur.role === 'livreur') {
      const [mission] = await db
        .select({ id: lignesLivraison.id, quantite: lignesLivraison.quantiteDemandee, commandeId: livraisons.commandeId, statut: livraisons.statut, commandeStatut: commandes.statut })
        .from(lignesLivraison)
        .innerJoin(livraisons, eq(livraisons.id, lignesLivraison.livraisonId))
        .innerJoin(commandes, eq(commandes.id, livraisons.commandeId))
        .where(and(eq(lignesLivraison.ligneCommandeId, ligne.ligneCommandeId), eq(livraisons.livreurId, collecteur.id), inArray(livraisons.statut, ['ASSIGNEE', 'EN_ROUTE', 'ARRIVE'])))
        .limit(1);
      if (!mission || mission.commandeStatut !== 'PAYEE' || mission.commandeId !== lc.commandeId) throw forbidden('Cet article ne fait pas partie de vos collectes autorisées.');
      if (ligne.quantite !== mission.quantite) throw badRequest('La quantité signalée doit correspondre à la quantité affectée au livreur.');
      const [deja] = await db.select({ id: lignesBordereau.id }).from(lignesBordereau).innerJoin(bordereaux, eq(bordereaux.id, lignesBordereau.bordereauId)).where(and(eq(lignesBordereau.ligneCommandeId, ligne.ligneCommandeId), notInArray(bordereaux.statut, ['REFUSE', 'ANNULE']))).limit(1);
      if (deja) throw conflict('Cet article a déjà été signalé comme récupéré.');
    }
  }

  // La collecte physique doit être confirmée par le commerçant, puis validée par l'admin principal.
  const statut = 'ATTENTE_PARTENAIRE';

  // Bordereau, lignes et journal dans une même transaction : tout ou rien.
  return db.transaction(async (tx) => {
    const [bd] = await tx
      .insert(bordereaux)
      .values({
        entrepriseId: b.entrepriseId,
        etablissementId,
        collecteurId: collecteur.id,
        statut,
        commentaire: b.commentaire ?? null,
      })
      .returning();

    const lignes = await tx
      .insert(lignesBordereau)
      .values(
        b.lignes.map((l) => ({
          bordereauId: bd.id,
          produitId: l.produitId,
          ligneCommandeId: l.ligneCommandeId ?? null,
          nomArticle: parId.get(l.produitId)!.nom,
          quantite: l.quantite,
          etat: l.etat,
          accessoires: l.accessoires ?? null,
          testEffectue: l.testEffectue,
          resultatTest: l.resultatTest ?? null,
          controle: l.controle,
          commentaire: l.commentaire ?? null,
          bloqueLivraison: l.controle === 'ANOMALIE',
        })),
      )
      .returning();

    const partenairesDestinataires = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.entrepriseId, b.entrepriseId), eq(users.role, 'partenaire')));
    for (const p of partenairesDestinataires) {
      await notifier(tx, { destinataireId: p.id, type: 'COLLECTE_A_CONFIRMER', titre: 'Article récupéré par NZE', message: 'Le livreur a signalé la récupération de vos articles. Confirmez leur remise ou signalez une erreur.', cibleType: 'bordereau', cibleId: bd.id });
    }

    if (lignes.some((l) => l.bloqueLivraison)) {
      const partenaires = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.entrepriseId, b.entrepriseId), eq(users.role, 'partenaire')));
      for (const p of partenaires) {
        await notifier(tx, { destinataireId: p.id, type: 'ANOMALIE_QUALITE', titre: 'Anomalie de qualité', message: 'Un article de votre entreprise a une anomalie de qualité. Il est bloqué jusqu’à décision de NZE.', cibleType: 'bordereau', cibleId: bd.id });
      }
    }
    await journaliser(tx, {
      acteurId: collecteur.id,
      action: 'BORDEREAU_CREE',
      cibleType: 'bordereau',
      cibleId: bd.id,
      details: { statut, lignes: lignes.length, anomalies: lignes.filter((l) => l.bloqueLivraison).length },
    });
    return presenter(bd, lignes);
  });
}

export async function lireBordereau(db: Db, user: AuthUser, id: string) {
  const { bd, lignes } = await chargerBordereau(db, id);
  verifierAcces(user, bd);
  return presenter(bd, lignes);
}

// Le commerçant confirme la remise physique de l'article au livreur, ou conteste la saisie.
export async function repondreCollectePartenaire(db: Db, partenaire: AuthUser, id: string, reponse: { confirmer: boolean; motif?: string }) {
  const { bd } = await chargerBordereau(db, id);
  if (partenaire.role !== 'partenaire' || !partenaire.entrepriseId || partenaire.entrepriseId !== bd.entrepriseId) throw forbidden();
  if (bd.statut !== 'ATTENTE_PARTENAIRE') throw conflict('Cette collecte attend déjà une décision ou a été clôturée');
  if (!reponse.confirmer && (!reponse.motif || reponse.motif.trim().length < 5)) throw badRequest('Un motif détaillé est obligatoire pour signaler une erreur');
  const statut = reponse.confirmer ? 'ATTENTE_VALIDATION_NZE' : 'CONTESTE';
  await db.transaction(async (tx) => {
    await tx.update(bordereaux).set(reponse.confirmer
      ? { statut, partenaireConfirmePar: partenaire.id, partenaireConfirmeLe: new Date() }
      : { statut, contestePar: partenaire.id, contesteLe: new Date(), motifContestation: reponse.motif!.trim() }).where(eq(bordereaux.id, id));
    await journaliser(tx, { acteurId: partenaire.id, action: reponse.confirmer ? 'COLLECTE_REMISE_CONFIRMEE_PARTENAIRE' : 'COLLECTE_CONTESTEE_PARTENAIRE', cibleType: 'bordereau', cibleId: id, details: reponse.confirmer ? {} : { motif: reponse.motif!.trim() } });
    const admins = await tx.select({ id: users.id }).from(users).where(eq(users.role, 'admin_principal'));
    for (const a of admins) await notifier(tx, { destinataireId: a.id, type: reponse.confirmer ? 'COLLECTE_A_VALIDER' : 'COLLECTE_CONTESTEE', parametres: { motif: reponse.motif?.trim() ?? '' }, titre: reponse.confirmer ? 'Collecte à valider' : 'Collecte contestée', message: reponse.confirmer ? 'Le commerçant confirme la remise. La validation définitive est attendue.' : `Le commerçant conteste la collecte : ${reponse.motif!.trim()}`, cibleType: 'bordereau', cibleId: id });
  });
  const maj = await chargerBordereau(db, id);
  return presenter(maj.bd, maj.lignes);
}

// Articles d'une collecte validée entrent en stock. Une ligne bloquée (anomalie) n'entre qu'à la levée de son blocage.
async function entrerLignesCollectees(tx: Parameters<Parameters<Db['transaction']>[0]>[0], bordereauId: string, acteurId: string, numero: number) {
  const lignes = await tx
    .select()
    .from(lignesBordereau)
    .where(and(eq(lignesBordereau.bordereauId, bordereauId), eq(lignesBordereau.bloqueLivraison, false)));
  for (const l of lignes) {
    await entrerStockCollecte(tx, { type: 'COLLECTE', produitId: l.produitId, quantite: l.quantite, bordereauId, acteurId, motif: `Collecte ${numero}` });
  }
}

// Seul l'administrateur principal peut valider définitivement ou refuser une collecte.
export async function deciderCollecte(db: Db, admin: AuthUser, id: string, decision: { valider: boolean; motif?: string }) {
  if (admin.role !== 'admin_principal') throw forbidden();
  const { bd } = await chargerBordereau(db, id);
  if (!['ATTENTE_VALIDATION_NZE', 'CONTESTE'].includes(bd.statut)) throw conflict('La collecte doit être confirmée par le commerçant ou contestée avant décision');
  if (!decision.valider && (!decision.motif || decision.motif.trim().length < 5)) throw badRequest('Un motif détaillé est obligatoire pour refuser la collecte');
  const statut = decision.valider ? 'VALIDE' : 'REFUSE';
  await db.transaction(async (tx) => {
    await tx.update(bordereaux).set(decision.valider
      ? { statut, validePar: admin.id, valideLe: new Date(), motifRefus: null }
      : { statut, motifRefus: decision.motif!.trim() }).where(eq(bordereaux.id, id));
    if (decision.valider) await entrerLignesCollectees(tx, id, admin.id, bd.numero);
    await journaliser(tx, { acteurId: admin.id, action: decision.valider ? 'COLLECTE_VALIDEE_DEFINITIVEMENT' : 'COLLECTE_REFUSEE', cibleType: 'bordereau', cibleId: id, details: decision.valider ? { ancienStatut: bd.statut } : { ancienStatut: bd.statut, motif: decision.motif!.trim() } });
    const partenaires = await tx.select({ id: users.id }).from(users).where(and(eq(users.entrepriseId, bd.entrepriseId), eq(users.role, 'partenaire')));
    for (const p of partenaires) await notifier(tx, { destinataireId: p.id, type: decision.valider ? 'COLLECTE_VALIDEE' : 'COLLECTE_REFUSEE', cle: decision.valider ? 'COLLECTE_VALIDEE.partenaire' : 'COLLECTE_REFUSEE.partenaire', parametres: { motif: decision.motif?.trim() ?? '' }, titre: decision.valider ? 'Collecte validée par NZE' : 'Collecte refusée par NZE', message: decision.valider ? 'La collecte est définitivement validée.' : `La collecte a été refusée : ${decision.motif!.trim()}`, cibleType: 'bordereau', cibleId: id });
    await notifier(tx, { destinataireId: bd.collecteurId, type: decision.valider ? 'COLLECTE_VALIDEE' : 'COLLECTE_REFUSEE', cle: decision.valider ? 'COLLECTE_VALIDEE.collecteur' : 'COLLECTE_REFUSEE.collecteur', parametres: { motif: decision.motif?.trim() ?? '' }, titre: decision.valider ? 'Collecte validée' : 'Collecte refusée', message: decision.valider ? 'Votre collecte a été validée définitivement par NZE.' : `Votre collecte a été refusée : ${decision.motif!.trim()}`, cibleType: 'bordereau', cibleId: id });
  });
  const maj = await chargerBordereau(db, id);
  return presenter(maj.bd, maj.lignes);
}

export async function listerBordereaux(db: Db, user: AuthUser, filtres: { statut?: string }, page: Page) {
  const conditions = [];
  if (filtres.statut) conditions.push(eq(bordereaux.statut, filtres.statut));
  if (user.role === 'partenaire') {
    if (!user.entrepriseId) throw forbidden();
    conditions.push(eq(bordereaux.entrepriseId, user.entrepriseId));
  } else if (user.role === 'livreur') {
    conditions.push(eq(bordereaux.collecteurId, user.id));
  } else if (!ADMIN_ROLES.includes(user.role)) {
    throw forbidden();
  }
  const rows = await db
    .select({
      id: bordereaux.id, numero: bordereaux.numero, statut: bordereaux.statut,
      entrepriseId: bordereaux.entrepriseId, entrepriseNom: entreprises.nom,
      etablissementId: bordereaux.etablissementId, magasinNom: etablissements.nom, magasinAdresse: etablissements.adresse,
      collecteurId: bordereaux.collecteurId, livreurNom: users.nomAffiche,
      partenaireConfirmeLe: bordereaux.partenaireConfirmeLe, contesteLe: bordereaux.contesteLe,
      motifContestation: bordereaux.motifContestation, valideLe: bordereaux.valideLe, motifRefus: bordereaux.motifRefus,
      createdAt: bordereaux.createdAt,
    })
    .from(bordereaux)
    .innerJoin(entreprises, eq(entreprises.id, bordereaux.entrepriseId))
    .leftJoin(etablissements, eq(etablissements.id, bordereaux.etablissementId))
    .innerJoin(users, eq(users.id, bordereaux.collecteurId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(bordereaux.createdAt), desc(bordereaux.id))
    .limit(page.limite)
    .offset(page.decalage);
  if (rows.length === 0) return [];
  const lignes = await db.select().from(lignesBordereau).where(inArray(lignesBordereau.bordereauId, rows.map((r) => r.id)));
  const parBordereau = new Map<string, LigneBase[]>();
  for (const ligne of lignes) {
    const existantes = parBordereau.get(ligne.bordereauId) ?? [];
    existantes.push(ligne);
    parBordereau.set(ligne.bordereauId, existantes);
  }
  return rows.map((bd) => ({
    id: bd.id, reference: formatReference(bd.numero, bd.createdAt), statut: bd.statut,
    entrepriseId: bd.entrepriseId, entrepriseNom: bd.entrepriseNom,
    etablissementId: bd.etablissementId, magasinNom: bd.magasinNom ?? bd.entrepriseNom, magasinAdresse: bd.magasinAdresse,
    collecteurId: bd.collecteurId, livreurNom: bd.livreurNom,
    partenaireConfirmeLe: bd.partenaireConfirmeLe, contesteLe: bd.contesteLe, motifContestation: bd.motifContestation,
    valideLe: bd.valideLe, motifRefus: bd.motifRefus, createdAt: bd.createdAt,
    lignes: (parBordereau.get(bd.id) ?? []).map((l) => ({ id: l.id, produitId: l.produitId, ligneCommandeId: l.ligneCommandeId, nomArticle: l.nomArticle, quantite: l.quantite })),
  }));
}

// Annulation : le bordereau reste consultable. Les blocages déjà posés ne sont pas levés par l'annulation.
export async function annulerBordereau(db: Db, adminId: string, id: string, motif: string) {
  const { bd } = await chargerBordereau(db, id);
  if (bd.statut === 'ANNULE') throw conflict('Ce bordereau est déjà annulé');
  // Une collecte validée a fait entrer ses articles en stock : elle ne s'annule pas. Correction par un ajustement motivé.
  if (bd.statut === 'VALIDE') throw conflict('Une collecte validée ne s’annule pas : ses articles sont déjà entrés en stock. Corrigez par un ajustement motivé.');
  await db.transaction(async (tx) => {
    await tx.update(bordereaux).set({ statut: 'ANNULE' }).where(eq(bordereaux.id, id));
    await journaliser(tx, {
      acteurId: adminId,
      action: 'BORDEREAU_ANNULE',
      cibleType: 'bordereau',
      cibleId: id,
      details: { ancienStatut: bd.statut, motif },
    });
  });
  return { id, statut: 'ANNULE' as const };
}

// Levée d'un blocage de livraison, par décision explicite de NZE, avec motif journalisé.
export async function leverBlocage(db: Db, adminId: string, ligneId: string, motif: string) {
  return db.transaction(async (tx) => {
    const [ligne0] = await tx.select({ bordereauId: lignesBordereau.bordereauId }).from(lignesBordereau).where(eq(lignesBordereau.id, ligneId)).limit(1);
    if (!ligne0) throw notFound('Ligne introuvable');
    // Verrou sur la collecte d'abord : validation et levée de blocage ne peuvent pas se croiser.
    const [bd] = await tx.select({ statut: bordereaux.statut, numero: bordereaux.numero }).from(bordereaux).where(eq(bordereaux.id, ligne0.bordereauId)).for('update');
    const [ligne] = await tx.select().from(lignesBordereau).where(eq(lignesBordereau.id, ligneId)).for('update');
    if (!ligne.bloqueLivraison) throw conflict("Cette ligne n'est pas bloquée");
    await tx.update(lignesBordereau).set({ bloqueLivraison: false, motifLevee: motif }).where(eq(lignesBordereau.id, ligneId));
    // Collecte déjà validée : l'article entre en stock maintenant. Sinon il entrera à la validation.
    if (bd.statut === 'VALIDE') {
      await entrerStockCollecte(tx, { type: 'COLLECTE_DEBLOCAGE', produitId: ligne.produitId, quantite: ligne.quantite, bordereauId: ligne.bordereauId, acteurId: adminId, motif: `Déblocage collecte ${bd.numero}` });
    }
    await journaliser(tx, { acteurId: adminId, action: 'BLOCAGE_LEVE', cibleType: 'ligne_bordereau', cibleId: ligneId, details: { produitId: ligne.produitId, motif } });
    return { id: ligneId, bloqueLivraison: false, motifLevee: motif };
  });
}

export async function listerBlocages(db: Db) {
  return db
    .select({
      ligneId: lignesBordereau.id,
      produitId: lignesBordereau.produitId,
      nomArticle: lignesBordereau.nomArticle,
      commentaire: lignesBordereau.commentaire,
      bordereauId: bordereaux.id,
      numeroBordereau: bordereaux.numero,
      createdAt: bordereaux.createdAt,
    })
    .from(lignesBordereau)
    .innerJoin(bordereaux, eq(bordereaux.id, lignesBordereau.bordereauId))
    .where(eq(lignesBordereau.bloqueLivraison, true))
    .orderBy(desc(bordereaux.createdAt));
}

// Point d'entrée pour le module livraisons : un article bloqué ne doit pas être livré.
export async function articleBloqueLivraison(db: Db, produitId: string): Promise<boolean> {
  const [bloquee] = await db
    .select({ id: lignesBordereau.id })
    .from(lignesBordereau)
    .where(and(eq(lignesBordereau.produitId, produitId), eq(lignesBordereau.bloqueLivraison, true)))
    .limit(1);
  return Boolean(bloquee);
}
