import type { Page } from '../../core/pagination.ts';
// Litige entre NZE et un partenaire (révision 19, cahier §16.2). Suivi séparément du dossier client : jamais visible du client,
// jamais notifié au partenaire, administration seulement. Une réclamation peut être liée, mais elle ne se confond pas avec le litige.
import { and, desc, eq } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import type { AuthUser } from '../../core/auth.ts';
import { badRequest, conflict, notFound } from '../../core/errors.ts';
import { PRIORITES, type Priorite, verifierResponsable } from '../../core/responsables.ts';
import { entreprises, litigesPartenaire, produits, reclamations } from '../../db/schema.ts';
import { journaliser } from '../audit/service.ts';

export const STATUTS_LITIGE = ['OUVERT', 'CLOS'] as const;

export const formatReferenceLitige = (numero: number, date: Date): string =>
  `LIT-${date.getUTCFullYear()}-${String(numero).padStart(6, '0')}`;

type LitigeBase = typeof litigesPartenaire.$inferSelect;

function presenter(l: LitigeBase) {
  return {
    id: l.id,
    reference: formatReferenceLitige(l.numero, l.createdAt),
    entrepriseId: l.entrepriseId,
    reclamationId: l.reclamationId,
    motif: l.motif,
    description: l.description,
    statut: l.statut,
    priorite: l.priorite,
    responsableId: l.responsableId,
    ouvertPar: l.ouvertPar,
    issue: l.issue,
    clotureLe: l.clotureLe,
    createdAt: l.createdAt,
  };
}

export async function ouvrirLitige(
  db: Db,
  admin: AuthUser,
  b: { entrepriseId: string; reclamationId?: string; motif: string; description: string },
) {
  const [entreprise] = await db.select({ id: entreprises.id }).from(entreprises).where(eq(entreprises.id, b.entrepriseId)).limit(1);
  if (!entreprise) throw notFound('Partenaire introuvable');

  // Le dossier client lié doit concerner ce partenaire : on ne rattache pas un litige au mauvais partenaire.
  if (b.reclamationId) {
    const [r] = await db.select({ produitId: reclamations.produitId }).from(reclamations).where(eq(reclamations.id, b.reclamationId)).limit(1);
    if (!r) throw notFound('Réclamation introuvable');
    const [p] = await db.select({ entrepriseId: produits.entrepriseId }).from(produits).where(eq(produits.id, r.produitId)).limit(1);
    if (p?.entrepriseId !== b.entrepriseId) throw badRequest('La réclamation ne concerne pas ce partenaire');
  }

  return db.transaction(async (tx) => {
    const [l] = await tx
      .insert(litigesPartenaire)
      .values({
        entrepriseId: b.entrepriseId,
        reclamationId: b.reclamationId ?? null,
        motif: b.motif,
        description: b.description,
        ouvertPar: admin.id,
      })
      .returning();
    await journaliser(tx, {
      acteurId: admin.id,
      action: 'LITIGE_OUVERT',
      cibleType: 'litige_partenaire',
      cibleId: l.id,
      details: { entrepriseId: b.entrepriseId, reclamationId: b.reclamationId ?? null },
    });
    return presenter(l);
  });
}

export async function listerLitiges(db: Db, filtres: { statut?: string; entrepriseId?: string; priorite?: Priorite; responsableId?: string }, page: Page) {
  const conditions = [];
  if (filtres.statut) conditions.push(eq(litigesPartenaire.statut, filtres.statut));
  if (filtres.entrepriseId) conditions.push(eq(litigesPartenaire.entrepriseId, filtres.entrepriseId));
  if (filtres.priorite) conditions.push(eq(litigesPartenaire.priorite, filtres.priorite));
  if (filtres.responsableId) conditions.push(eq(litigesPartenaire.responsableId, filtres.responsableId));
  const rows = await db
    .select()
    .from(litigesPartenaire)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(litigesPartenaire.createdAt), desc(litigesPartenaire.id))
    .limit(page.limite)
    .offset(page.decalage);
  return rows.map(presenter);
}

export async function lireLitige(db: Db, id: string) {
  const [l] = await db.select().from(litigesPartenaire).where(eq(litigesPartenaire.id, id)).limit(1);
  if (!l) throw notFound('Litige introuvable');
  return presenter(l);
}

// Responsable et priorité. Un litige clos ne se modifie plus. null retire le responsable ; une clé absente ne change rien.
export async function assignerLitige(db: Db, admin: AuthUser, id: string, b: { responsableId?: string | null; priorite?: Priorite }) {
  if (b.responsableId === undefined && b.priorite === undefined) throw badRequest('Indiquez le responsable ou la priorité à enregistrer');
  if (b.responsableId) await verifierResponsable(db, b.responsableId);

  return db.transaction(async (tx) => {
    const [l] = await tx.select().from(litigesPartenaire).where(eq(litigesPartenaire.id, id)).for('update');
    if (!l) throw notFound('Litige introuvable');
    if (l.statut === 'CLOS') throw conflict('Ce litige est clos');

    const changements: Partial<typeof litigesPartenaire.$inferInsert> = {};
    if (b.responsableId !== undefined) changements.responsableId = b.responsableId;
    if (b.priorite !== undefined) changements.priorite = b.priorite;
    const [maj] = await tx.update(litigesPartenaire).set(changements).where(eq(litigesPartenaire.id, id)).returning();

    await journaliser(tx, {
      acteurId: admin.id,
      action: 'LITIGE_MIS_A_JOUR',
      cibleType: 'litige_partenaire',
      cibleId: id,
      details: {
        responsableAvant: l.responsableId,
        responsableApres: maj.responsableId,
        prioriteAvant: l.priorite,
        prioriteApres: maj.priorite,
      },
    });
    return presenter(maj);
  });
}

// Clôture avec l'issue retenue. L'issue est enregistrée dans le dossier, pas dans le journal (texte libre de gestion).
export async function cloreLitige(db: Db, admin: AuthUser, id: string, issue: string) {
  const texte = issue.trim();
  if (texte.length < 5) throw badRequest("Indiquez l'issue du litige (5 caractères minimum)");

  return db.transaction(async (tx) => {
    const [l] = await tx.select().from(litigesPartenaire).where(eq(litigesPartenaire.id, id)).for('update');
    if (!l) throw notFound('Litige introuvable');
    if (l.statut === 'CLOS') throw conflict('Ce litige est déjà clos');

    const [maj] = await tx
      .update(litigesPartenaire)
      .set({ statut: 'CLOS', issue: texte, clotureLe: new Date(), cloturePar: admin.id })
      .where(eq(litigesPartenaire.id, id))
      .returning();
    await journaliser(tx, {
      acteurId: admin.id,
      action: 'LITIGE_CLOS',
      cibleType: 'litige_partenaire',
      cibleId: id,
      details: { reclamationId: l.reclamationId },
    });
    return presenter(maj);
  });
}
