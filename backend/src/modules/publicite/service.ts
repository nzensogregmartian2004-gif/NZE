// Fiches des prestataires publicitaires (D-P6) : administrées par NZE.
// Pas de réservation de service, pas de compte ni de tableau de bord prestataire, pas de publication par le prestataire.
// Une demande du client est transmise à NZE, qui rappelle le client : aucune donnée de prestataire n'est exposée hors de la fiche.
import { and, asc, desc, eq } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import { demandesPrestataire, fichesPrestataires, users } from '../../db/schema.ts';
import type { AuthUser } from '../../core/auth.ts';
import { AppError, conflict, notFound } from '../../core/errors.ts';
import { cleImage, verifierImage, type Stockage } from '../stockage/r2.ts';
import { journaliser } from '../audit/service.ts';

export const STATUTS_FICHE = ['BROUILLON', 'PUBLIEE', 'SUSPENDUE'] as const;
export const STATUTS_DEMANDE = ['NOUVELLE', 'TRAITEE', 'CLOTUREE'] as const;
export const MOTIFS_DEMANDE = ['INFORMATION', 'DEVIS', 'AUTRE'] as const;

// Vue client : seulement les fiches publiées, sans statut interne ni clé de stockage.
type LignePublique = { id: string; nomPublic: string; activite: string; description: string; zone: string | null; photoCle: string | null };

async function versVuePublique(l: LignePublique, stockage: Stockage | null) {
  return {
    id: l.id,
    nomPublic: l.nomPublic,
    activite: l.activite,
    description: l.description,
    zone: l.zone,
    photoUrl: l.photoCle && stockage ? await stockage.urlSignee(l.photoCle) : null,
  };
}

const colonnesPubliques = {
  id: fichesPrestataires.id,
  nomPublic: fichesPrestataires.nomPublic,
  activite: fichesPrestataires.activite,
  description: fichesPrestataires.description,
  zone: fichesPrestataires.zone,
  photoCle: fichesPrestataires.photoCle,
};

export async function listerFichesPubliees(db: Db, stockage: Stockage | null) {
  const lignes = await db
    .select(colonnesPubliques)
    .from(fichesPrestataires)
    .where(eq(fichesPrestataires.statut, 'PUBLIEE'))
    .orderBy(asc(fichesPrestataires.ordre), asc(fichesPrestataires.nomPublic), asc(fichesPrestataires.id));
  return Promise.all(lignes.map((l) => versVuePublique(l, stockage)));
}

export async function detaillerFichePubliee(db: Db, id: string, stockage: Stockage | null) {
  const [f] = await db
    .select(colonnesPubliques)
    .from(fichesPrestataires)
    .where(and(eq(fichesPrestataires.id, id), eq(fichesPrestataires.statut, 'PUBLIEE')))
    .limit(1);
  if (!f) throw notFound('Prestataire introuvable');
  return versVuePublique(f, stockage);
}

// Demande du client. Une seule demande en cours par client et par fiche, pour éviter les doublons.
export async function demanderPrestataire(db: Db, client: AuthUser, ficheId: string, b: { motif: (typeof MOTIFS_DEMANDE)[number]; message: string }) {
  return db.transaction(async (tx) => {
    const [fiche] = await tx
      .select({ id: fichesPrestataires.id })
      .from(fichesPrestataires)
      .where(and(eq(fichesPrestataires.id, ficheId), eq(fichesPrestataires.statut, 'PUBLIEE')))
      .limit(1);
    if (!fiche) throw notFound('Prestataire introuvable');
    const [enCours] = await tx
      .select({ id: demandesPrestataire.id })
      .from(demandesPrestataire)
      .where(and(eq(demandesPrestataire.ficheId, ficheId), eq(demandesPrestataire.clientId, client.id), eq(demandesPrestataire.statut, 'NOUVELLE')))
      .limit(1);
    if (enCours) throw conflict('Une demande est déjà en cours pour ce prestataire');
    const [d] = await tx
      .insert(demandesPrestataire)
      .values({ ficheId, clientId: client.id, motif: b.motif, message: b.message.trim() })
      .returning({ id: demandesPrestataire.id, statut: demandesPrestataire.statut, createdAt: demandesPrestataire.createdAt });
    return d;
  });
}

// ----- Administration -----

export async function listerFichesAdmin(db: Db) {
  return db.select().from(fichesPrestataires).orderBy(asc(fichesPrestataires.ordre), asc(fichesPrestataires.nomPublic));
}

export async function creerFiche(
  db: Db,
  acteurId: string,
  data: { nomPublic: string; activite: string; description?: string; zone?: string; ordre?: number; statut?: (typeof STATUTS_FICHE)[number] },
) {
  return db.transaction(async (tx) => {
    const [f] = await tx.insert(fichesPrestataires).values(data).returning();
    await journaliser(tx, { acteurId, action: 'FICHE_PRESTATAIRE_CREEE', cibleType: 'fiche_prestataire', cibleId: f.id, details: { statut: f.statut } });
    return f;
  });
}

export async function modifierFiche(
  db: Db,
  acteurId: string,
  id: string,
  changements: { nomPublic?: string; activite?: string; description?: string; zone?: string | null; ordre?: number; statut?: (typeof STATUTS_FICHE)[number] },
) {
  return db.transaction(async (tx) => {
    const [f] = await tx.update(fichesPrestataires).set(changements).where(eq(fichesPrestataires.id, id)).returning();
    if (!f) throw notFound('Prestataire introuvable');
    await journaliser(tx, { acteurId, action: 'FICHE_PRESTATAIRE_MODIFIEE', cibleType: 'fiche_prestataire', cibleId: id, details: { champs: Object.keys(changements).join(',') } });
    return f;
  });
}

// Demandes reçues, avec le numéro du client pour que NZE puisse le rappeler.
export async function listerDemandes(db: Db, statut?: (typeof STATUTS_DEMANDE)[number]) {
  const conditions = statut ? [eq(demandesPrestataire.statut, statut)] : [];
  return db
    .select({
      id: demandesPrestataire.id,
      motif: demandesPrestataire.motif,
      message: demandesPrestataire.message,
      statut: demandesPrestataire.statut,
      noteNze: demandesPrestataire.noteNze,
      traiteeLe: demandesPrestataire.traiteeLe,
      createdAt: demandesPrestataire.createdAt,
      ficheId: fichesPrestataires.id,
      fichePublic: fichesPrestataires.nomPublic,
      clientTelephone: users.telephone,
      clientNom: users.nomAffiche,
    })
    .from(demandesPrestataire)
    .innerJoin(fichesPrestataires, eq(fichesPrestataires.id, demandesPrestataire.ficheId))
    .innerJoin(users, eq(users.id, demandesPrestataire.clientId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(demandesPrestataire.createdAt));
}

// Traitement par NZE : la demande passe à traitée (rappel fait) puis à clôturée. Une note interne peut être ajoutée.
export async function traiterDemande(db: Db, acteurId: string, id: string, b: { statut: 'TRAITEE' | 'CLOTUREE'; note?: string }) {
  return db.transaction(async (tx) => {
    const [d] = await tx
      .update(demandesPrestataire)
      .set({ statut: b.statut, noteNze: b.note ?? null, traiteeLe: new Date(), traiteePar: acteurId })
      .where(eq(demandesPrestataire.id, id))
      .returning();
    if (!d) throw notFound('Demande introuvable');
    await journaliser(tx, { acteurId, action: 'DEMANDE_PRESTATAIRE_TRAITEE', cibleType: 'demande_prestataire', cibleId: id, details: { statut: b.statut } });
    return d;
  });
}

// Photo de la fiche (D-P6-M5). Le contenu est vérifié sur ses octets réels, pas sur le seul type annoncé.
export async function definirPhotoFiche(db: Db, stockage: Stockage | null, acteurId: string, ficheId: string, contenuBase64: string, typeMime: string) {
  if (!stockage) throw new AppError(503, 'STOCKAGE_NON_CONFIGURE', 'Le stockage des photos n’est pas configuré');
  const contenu = Buffer.from(contenuBase64, 'base64');
  verifierImage(contenu, typeMime);
  const [fiche] = await db
    .select({ id: fichesPrestataires.id, ancienne: fichesPrestataires.photoCle })
    .from(fichesPrestataires)
    .where(eq(fichesPrestataires.id, ficheId))
    .limit(1);
  if (!fiche) throw notFound('Prestataire introuvable');
  const cle = cleImage('fiches-prestataires', ficheId, typeMime);
  await stockage.envoyer(cle, contenu, typeMime);
  await db.transaction(async (tx) => {
    await tx.update(fichesPrestataires).set({ photoCle: cle }).where(eq(fichesPrestataires.id, ficheId));
    await journaliser(tx, { acteurId, action: 'FICHE_PRESTATAIRE_PHOTO', cibleType: 'fiche_prestataire', cibleId: ficheId, details: { taille: contenu.length, type: typeMime } });
  });
  // L'ancienne photo est supprimée au mieux : un échec ne doit pas annuler le remplacement.
  if (fiche.ancienne) await stockage.supprimer(fiche.ancienne).catch(() => undefined);
  return { photoUrl: await stockage.urlSignee(cle) };
}
