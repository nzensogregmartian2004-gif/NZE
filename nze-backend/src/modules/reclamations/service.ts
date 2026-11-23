import type { Page } from '../../core/pagination.ts';
// Réclamations des clients (révision 13, cahier §16). NZE ouvre un dossier, décide dans un délai, enregistre la solution.
// Une réclamation ne porte que sur un article effectivement livré. Pour un article, la solution est un remplacement
// (décision de novembre 2026) : le remboursement n'est pas proposé ici. Le remboursement d'une ligne annulée pour rupture
// (cahier §11.3) relève d'un autre parcours, rattaché au paiement d'origine et confirmé par le prestataire (décision 13 du suivi).
// Révision 19 (cahier §17.2) : responsable, priorité et notes internes, réservés à l'administration. Alerte automatique
// sur les dossiers dont le délai est dépassé. Le litige entre NZE et le partenaire est un dossier séparé (modules/litiges-partenaire).
import { and, asc, desc, eq, inArray, isNull, lt, not } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import { ADMIN_ROLES, type AuthUser } from '../../core/auth.ts';
import { badRequest, conflict, forbidden, notFound } from '../../core/errors.ts';
import { idsAdministrateurs, type Priorite, verifierResponsable } from '../../core/responsables.ts';
import { commandes, lignesCommande, lignesLivraison, livraisons, produits, reclamations, reclamationsNotes, users } from '../../db/schema.ts';
import { journaliser, type Executeur } from '../audit/service.ts';
import { notifier } from '../notifications/service.ts';

export const MOTIFS_RECLAMATION = ['ARTICLE_DEFECTUEUX', 'NON_CONFORME', 'DOMMAGE_LIVRAISON', 'ARTICLE_MANQUANT', 'AUTRE'] as const;
// Pour un article, la seule solution acceptée est le remplacement (décision de novembre 2026).
// Les dossiers déjà enregistrés gardent leur valeur d'origine.
export const SOLUTIONS = ['REMPLACEMENT'] as const;
export const STATUTS_RECLAMATION = ['OUVERTE', 'ACCEPTEE', 'REFUSEE', 'CLOTUREE'] as const;

// Délai de décision par défaut (plan, règle de travail). Les exceptions attendent la décision 11 du suivi.
export const DELAI_DECISION_HEURES = 72;
const HEURE_MS = 60 * 60 * 1000;
const JOUR_MS = 24 * HEURE_MS;

const LIBELLE_SOLUTION: Record<(typeof SOLUTIONS)[number], string> = {
  REMPLACEMENT: 'remplacement de l’article',
};

export const formatReference = (numero: number, date: Date): string =>
  `REC-${date.getUTCFullYear()}-${String(numero).padStart(6, '0')}`;

// Garantie commerciale : durée figée à la vente, comptée depuis la livraison. Aucune garantie si la durée est nulle.
export function garantieDe(garantieJours: number | null, debut: Date | null, maintenant = new Date()) {
  if (!garantieJours || garantieJours <= 0 || !debut) {
    return { jours: null as number | null, active: false, debutLe: debut, finLe: null as Date | null };
  }
  const finLe = new Date(debut.getTime() + garantieJours * JOUR_MS);
  return { jours: garantieJours, active: maintenant <= finLe, debutLe: debut, finLe };
}

type ReclamationBase = typeof reclamations.$inferSelect;

interface Personne { nom: string | null; telephone: string }
interface NoteVue { id: string; texte: string; auteur: { id: string; nom: string | null }; createdAt: Date }
// Vue administration : ce qui n'est jamais montré au client (coordonnées, responsable, priorité, notes internes).
interface VueStaff { client?: Personne; responsable: { id: string; nom: string | null } | null; notes?: NoteVue[] }

// Coordonnées : réservées à l'administration, pour joindre le client ou le responsable.
async function personnesParId(executeur: Executeur, ids: Array<string | null | undefined>): Promise<Map<string, Personne>> {
  const uniques = [...new Set(ids.filter((id): id is string => typeof id === 'string'))];
  if (uniques.length === 0) return new Map();
  const rows = await executeur
    .select({ id: users.id, nom: users.nomAffiche, telephone: users.telephone })
    .from(users)
    .where(inArray(users.id, uniques));
  return new Map(rows.map((r) => [r.id, { nom: r.nom, telephone: r.telephone }]));
}

function presenter(r: ReclamationBase, maintenant = new Date(), staff?: VueStaff) {
  return {
    id: r.id,
    reference: formatReference(r.numero, r.createdAt),
    statut: r.statut,
    motif: r.motif,
    description: r.description,
    nomArticle: r.nomArticle,
    produitId: r.produitId,
    commandeId: r.commandeId,
    ligneCommandeId: r.ligneCommandeId,
    echeanceDecisionLe: r.echeanceDecisionLe,
    enRetard: r.statut === 'OUVERTE' && r.echeanceDecisionLe.getTime() < maintenant.getTime(),
    solution: r.solution,
    motifDecision: r.motifDecision,
    decideLe: r.decideLe,
    clotureLe: r.clotureLe,
    createdAt: r.createdAt,
    ...(staff
      ? {
          client: staff.client,
          priorite: r.priorite,
          responsable: staff.responsable,
          ...(staff.notes ? { notes: staff.notes } : {}),
        }
      : {}),
  };
}

// Vue administration d'un dossier : client, responsable, priorité, et si demandé, notes internes.
async function vueStaff(db: Executeur, r: ReclamationBase, avecNotes: boolean) {
  const notes = avecNotes
    ? await db
        .select({ id: reclamationsNotes.id, texte: reclamationsNotes.texte, auteurId: reclamationsNotes.auteurId, createdAt: reclamationsNotes.createdAt })
        .from(reclamationsNotes)
        .where(eq(reclamationsNotes.reclamationId, r.id))
        .orderBy(asc(reclamationsNotes.createdAt))
    : undefined;
  const personnes = await personnesParId(db, [r.clientId, r.responsableId, ...(notes ?? []).map((n) => n.auteurId)]);
  const responsable = r.responsableId ? { id: r.responsableId, nom: personnes.get(r.responsableId)?.nom ?? null } : null;
  const notesVues = notes?.map((n) => ({
    id: n.id,
    texte: n.texte,
    auteur: { id: n.auteurId, nom: personnes.get(n.auteurId)?.nom ?? null },
    createdAt: n.createdAt,
  }));
  return { client: personnes.get(r.clientId), responsable, notes: notesVues };
}

export async function declarerReclamation(db: Db, client: AuthUser, b: { ligneCommandeId: string; motif: (typeof MOTIFS_RECLAMATION)[number]; description: string }) {
  const [ligne] = await db
    .select({
      id: lignesCommande.id,
      commandeId: lignesCommande.commandeId,
      produitId: lignesCommande.produitId,
      garantieJours: lignesCommande.garantieJours,
      nomArticle: produits.nom,
      clientId: commandes.userId,
    })
    .from(lignesCommande)
    .innerJoin(commandes, eq(commandes.id, lignesCommande.commandeId))
    .innerJoin(produits, eq(produits.id, lignesCommande.produitId))
    .where(eq(lignesCommande.id, b.ligneCommandeId))
    .limit(1);
  if (!ligne || ligne.clientId !== client.id) throw notFound('Article introuvable');

  // Ce qui a réellement été remis : une réclamation ne porte pas sur un article non livré.
  const remises = await db
    .select({ quantiteLivree: lignesLivraison.quantiteLivree, clotureeLe: livraisons.clotureeLe })
    .from(lignesLivraison)
    .innerJoin(livraisons, eq(livraisons.id, lignesLivraison.livraisonId))
    .where(and(eq(lignesLivraison.ligneCommandeId, ligne.id), inArray(livraisons.statut, ['LIVREE', 'PARTIELLE'])));
  const datesRemise = remises
    .filter((r) => r.quantiteLivree > 0 && r.clotureeLe !== null)
    .map((r) => r.clotureeLe as Date)
    .sort((a, b) => a.getTime() - b.getTime());
  if (datesRemise.length === 0) throw conflict('Une réclamation ne peut porter que sur un article livré');

  const ouverte = await db
    .select({ id: reclamations.id })
    .from(reclamations)
    .where(and(eq(reclamations.ligneCommandeId, ligne.id), inArray(reclamations.statut, ['OUVERTE', 'ACCEPTEE'])))
    .limit(1);
  if (ouverte.length > 0) throw conflict('Une réclamation est déjà ouverte pour cet article');

  const echeance = new Date(Date.now() + DELAI_DECISION_HEURES * HEURE_MS);
  const cree = await db.transaction(async (tx) => {
    const [r] = await tx
      .insert(reclamations)
      .values({
        clientId: client.id,
        commandeId: ligne.commandeId,
        ligneCommandeId: ligne.id,
        produitId: ligne.produitId,
        nomArticle: ligne.nomArticle,
        motif: b.motif,
        description: b.description,
        echeanceDecisionLe: echeance,
      })
      .returning();
    await journaliser(tx, { acteurId: client.id, action: 'RECLAMATION_CREEE', cibleType: 'reclamation', cibleId: r.id, details: { motif: b.motif, ligneCommandeId: ligne.id } });
    await notifier(tx, {
      destinataireId: client.id,
      type: 'RECLAMATION_RECUE', parametres: { delai: DELAI_DECISION_HEURES },
      titre: 'Réclamation enregistrée',
      message: `NZE examine votre réclamation et vous répond dans un délai de ${DELAI_DECISION_HEURES} heures.`,
      cibleType: 'reclamation',
      cibleId: r.id,
    });
    return r;
  });
  return { ...presenter(cree), garantie: garantieDe(ligne.garantieJours, datesRemise[0]) };
}

export async function listerReclamations(
  db: Db,
  user: AuthUser,
  filtres: { statut?: string; enRetard?: boolean; priorite?: Priorite; responsableId?: string },
  page: Page,
) {
  const conditions = [];
  const maintenant = new Date();
  const staff = ADMIN_ROLES.includes(user.role);
  if (user.role === 'client') {
    conditions.push(eq(reclamations.clientId, user.id));
  } else if (staff) {
    if (filtres.statut) conditions.push(eq(reclamations.statut, filtres.statut));
    if (filtres.priorite) conditions.push(eq(reclamations.priorite, filtres.priorite));
    if (filtres.responsableId) conditions.push(eq(reclamations.responsableId, filtres.responsableId));
  } else {
    throw forbidden();
  }
  // Le retard est filtré dans la base, avant la limite de lignes (sinon un dossier en retard pouvait être perdu).
  if (filtres.enRetard !== undefined) {
    const retard = and(eq(reclamations.statut, 'OUVERTE'), lt(reclamations.echeanceDecisionLe, maintenant))!;
    conditions.push(filtres.enRetard ? retard : not(retard)!);
  }
  const rows = await db
    .select()
    .from(reclamations)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(reclamations.createdAt), desc(reclamations.id))
    .limit(page.limite)
    .offset(page.decalage);
  if (!staff) return rows.map((r) => presenter(r, maintenant));
  const personnes = await personnesParId(db, [...rows.map((r) => r.clientId), ...rows.map((r) => r.responsableId)]);
  return rows.map((r) =>
    presenter(r, maintenant, {
      client: personnes.get(r.clientId),
      responsable: r.responsableId ? { id: r.responsableId, nom: personnes.get(r.responsableId)?.nom ?? null } : null,
    }),
  );
}

// Un client ne voit que ses réclamations. Une réclamation d'un autre reçoit « introuvable », pour ne pas révéler son existence.
export async function lireReclamation(db: Db, user: AuthUser, id: string) {
  const [r] = await db.select().from(reclamations).where(eq(reclamations.id, id)).limit(1);
  if (!r) throw notFound('Réclamation introuvable');
  if (ADMIN_ROLES.includes(user.role)) return presenter(r, new Date(), await vueStaff(db, r, true));
  if (user.role === 'client' && r.clientId === user.id) return presenter(r);
  throw notFound('Réclamation introuvable');
}

export async function decider(db: Db, admin: AuthUser, id: string, b: { decision: 'ACCEPTER' | 'REFUSER'; solution?: (typeof SOLUTIONS)[number]; motif?: string }) {
  if (b.decision === 'ACCEPTER' && !b.solution) throw badRequest('Indiquez la solution retenue');
  if (b.decision === 'REFUSER' && (!b.motif || b.motif.trim().length < 5)) throw badRequest('Indiquez le motif du refus (5 caractères minimum)');

  return db.transaction(async (tx) => {
    const [r] = await tx.select().from(reclamations).where(eq(reclamations.id, id)).for('update');
    if (!r) throw notFound('Réclamation introuvable');
    if (r.statut !== 'OUVERTE') throw conflict('Cette réclamation a déjà été traitée');

    const acceptee = b.decision === 'ACCEPTER';
    const [maj] = await tx
      .update(reclamations)
      .set({
        statut: acceptee ? 'ACCEPTEE' : 'REFUSEE',
        solution: acceptee ? b.solution! : null,
        motifDecision: b.motif?.trim() ?? null,
        decidePar: admin.id,
        decideLe: new Date(),
      })
      .where(eq(reclamations.id, id))
      .returning();

    await journaliser(tx, {
      acteurId: admin.id,
      action: 'RECLAMATION_DECIDEE',
      cibleType: 'reclamation',
      cibleId: id,
      details: { decision: b.decision, solution: acteurSolution(b.solution) },
    });
    await notifier(tx, acceptee
      ? {
          destinataireId: r.clientId,
          type: 'RECLAMATION_ACCEPTEE', parametres: { solution: b.solution! },
          titre: 'Réclamation acceptée',
          message: `NZE vous propose : ${LIBELLE_SOLUTION[b.solution!]}. Nous vous contactons pour la mise en œuvre.`,
          cibleType: 'reclamation',
          cibleId: id,
        }
      : {
          destinataireId: r.clientId,
          type: 'RECLAMATION_REFUSEE', parametres: { motif: b.motif?.trim() ?? '' },
          titre: 'Réclamation non retenue',
          message: `NZE n’a pas retenu votre réclamation. Motif : ${b.motif?.trim() ?? ''}. Contactez NZE pour plus d’informations.`,
          cibleType: 'reclamation',
          cibleId: id,
        });
    return presenter(maj);
  });
}

function acteurSolution(solution: (typeof SOLUTIONS)[number] | undefined): string | null {
  return solution ?? null;
}

export async function cloturerReclamation(db: Db, admin: AuthUser, id: string) {
  const [r] = await db.select().from(reclamations).where(eq(reclamations.id, id)).limit(1);
  if (!r) throw notFound('Réclamation introuvable');
  if (r.statut !== 'ACCEPTEE') throw conflict('Seule une réclamation acceptée peut être clôturée');
  await db.transaction(async (tx) => {
    await tx.update(reclamations).set({ statut: 'CLOTUREE', clotureLe: new Date() }).where(eq(reclamations.id, id));
    await journaliser(tx, { acteurId: admin.id, action: 'RECLAMATION_CLOTUREE', cibleType: 'reclamation', cibleId: id, details: { solution: r.solution } });
    await notifier(tx, {
      destinataireId: r.clientId,
      type: 'RECLAMATION_CLOTUREE',
      titre: 'Réclamation clôturée',
      message: 'Votre réclamation est clôturée. Merci de nous avoir écrit.',
      cibleType: 'reclamation',
      cibleId: id,
    });
  });
  return { id, statut: 'CLOTUREE' as const };
}

// Responsable et priorité (cahier §17.2). Un dossier clôturé ne se modifie plus.
// responsableId : null retire le responsable ; absent, il ne change pas.
export async function assignerReclamation(db: Db, admin: AuthUser, id: string, b: { responsableId?: string | null; priorite?: Priorite }) {
  if (b.responsableId === undefined && b.priorite === undefined) throw badRequest('Indiquez le responsable ou la priorité à enregistrer');
  if (b.responsableId) await verifierResponsable(db, b.responsableId);

  return db.transaction(async (tx) => {
    const [r] = await tx.select().from(reclamations).where(eq(reclamations.id, id)).for('update');
    if (!r) throw notFound('Réclamation introuvable');
    if (r.statut === 'CLOTUREE') throw conflict('Ce dossier est clôturé');

    const changements: Partial<typeof reclamations.$inferInsert> = {};
    if (b.responsableId !== undefined) changements.responsableId = b.responsableId;
    if (b.priorite !== undefined) changements.priorite = b.priorite;
    const [maj] = await tx.update(reclamations).set(changements).where(eq(reclamations.id, id)).returning();

    await journaliser(tx, {
      acteurId: admin.id,
      action: 'RECLAMATION_MISE_A_JOUR',
      cibleType: 'reclamation',
      cibleId: id,
      details: {
        responsableAvant: r.responsableId,
        responsableApres: maj.responsableId,
        prioriteAvant: r.priorite,
        prioriteApres: maj.priorite,
      },
    });
    return presenter(maj, new Date(), await vueStaff(tx, maj, false));
  });
}

// Note interne : jamais visible du client. Le texte n'est pas recopié dans le journal, seul l'identifiant de la note l'est.
export async function ajouterNote(db: Db, admin: AuthUser, id: string, texte: string) {
  const contenu = texte.trim();
  if (contenu.length === 0) throw badRequest('La note ne peut pas être vide');
  return db.transaction(async (tx) => {
    const [r] = await tx.select({ id: reclamations.id }).from(reclamations).where(eq(reclamations.id, id)).limit(1);
    if (!r) throw notFound('Réclamation introuvable');
    const [note] = await tx.insert(reclamationsNotes).values({ reclamationId: id, auteurId: admin.id, texte: contenu }).returning();
    await journaliser(tx, { acteurId: admin.id, action: 'RECLAMATION_NOTE_AJOUTEE', cibleType: 'reclamation', cibleId: id, details: { noteId: note.id } });
    const auteurs = await personnesParId(tx, [admin.id]);
    return {
      id: note.id,
      texte: note.texte,
      auteur: { id: admin.id, nom: auteurs.get(admin.id)?.nom ?? null },
      createdAt: note.createdAt,
    };
  });
}

// Alerte automatique : une seule fois par dossier, à la première exécution après l'échéance.
// Destinataire : le responsable s'il est désigné, sinon tous les administrateurs. Sans acteur humain : acteurId est vide dans le journal.
export async function alerterDossiersEnRetard(db: Db, maintenant = new Date()): Promise<{ dossiers: number }> {
  const candidats = await db
    .select({ id: reclamations.id })
    .from(reclamations)
    .where(and(eq(reclamations.statut, 'OUVERTE'), lt(reclamations.echeanceDecisionLe, maintenant), isNull(reclamations.alerteRetardLe)));

  let alertes = 0;
  for (const candidat of candidats) {
    const alerte = await db.transaction(async (tx) => {
      const [r] = await tx.select().from(reclamations).where(eq(reclamations.id, candidat.id)).for('update');
      // Revérifié sous verrou : une décision, ou une autre exécution du job, peut être passée entre-temps.
      if (!r || r.statut !== 'OUVERTE' || r.alerteRetardLe || r.echeanceDecisionLe.getTime() >= maintenant.getTime()) return false;

      await tx.update(reclamations).set({ alerteRetardLe: maintenant }).where(eq(reclamations.id, r.id));
      const destinataires = r.responsableId ? [r.responsableId] : await idsAdministrateurs(tx);
      const reference = formatReference(r.numero, r.createdAt);
      for (const destinataireId of destinataires) {
        await notifier(tx, {
          destinataireId,
          type: 'RECLAMATION_EN_RETARD', parametres: { reference, delai: DELAI_DECISION_HEURES },
          titre: 'Dossier en retard',
          message: `${reference} : le délai de décision de ${DELAI_DECISION_HEURES} heures est dépassé. Une décision est attendue.`,
          cibleType: 'reclamation',
          cibleId: r.id,
        });
      }
      await journaliser(tx, { acteurId: null, action: 'RECLAMATION_EN_RETARD', cibleType: 'reclamation', cibleId: r.id, details: { destinataires: destinataires.length } });
      return true;
    });
    if (alerte) alertes += 1;
  }
  return { dossiers: alertes };
}
