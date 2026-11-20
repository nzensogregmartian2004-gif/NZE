// Cycle de vie d'une entreprise partenaire (cahier V3.0 §8.4, décision D-F1).
// prospect -> négociation -> actif -> suspendu -> clôturé. Un partenaire ne devient actif qu'avec une commission définie.
import { and, desc, eq, lte } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import { commissionsRegles, entreprises } from '../../db/schema.ts';
import { conflict, notFound } from '../../core/errors.ts';
import { journaliser, type Executeur } from '../audit/service.ts';

export const STATUTS_ENTREPRISE = ['prospect', 'negociation', 'actif', 'suspendu', 'cloture'] as const;
export type StatutEntreprise = (typeof STATUTS_ENTREPRISE)[number];

export const TRANSITIONS: Record<StatutEntreprise, readonly StatutEntreprise[]> = {
  prospect: ['negociation', 'cloture'],
  negociation: ['prospect', 'actif', 'cloture'],
  actif: ['suspendu', 'cloture'],
  suspendu: ['actif', 'cloture'],
  cloture: [],
};

export async function commissionActive(executeur: Executeur, entrepriseId: string, a: Date = new Date()): Promise<boolean> {
  const [regle] = await executeur
    .select({ id: commissionsRegles.id })
    .from(commissionsRegles)
    .where(and(eq(commissionsRegles.entrepriseId, entrepriseId), lte(commissionsRegles.effetDebut, a)))
    .orderBy(desc(commissionsRegles.effetDebut))
    .limit(1);
  return Boolean(regle);
}

export async function changerStatutEntreprise(
  db: Db, entrepriseId: string, cible: StatutEntreprise, acteurId: string, motif?: string,
) {
  return db.transaction(async (tx) => {
    const [e] = await tx.select().from(entreprises).where(eq(entreprises.id, entrepriseId)).for('update').limit(1);
    if (!e) throw notFound('Entreprise introuvable');
    const actuel = e.statutPartenariat as StatutEntreprise;
    if (cible === actuel) throw conflict(`L’entreprise est déjà « ${actuel} »`);
    if (!TRANSITIONS[actuel].includes(cible)) {
      throw conflict(`Passage de « ${actuel} » à « ${cible} » impossible`);
    }
    if (cible === 'actif' && !(await commissionActive(tx, entrepriseId))) {
      throw conflict('Activation impossible : une commission doit être définie pour cette entreprise');
    }
    await tx.update(entreprises).set({ statutPartenariat: cible }).where(eq(entreprises.id, entrepriseId));
    await journaliser(tx, {
      acteurId, action: 'ENTREPRISE_STATUT', cibleType: 'entreprise', cibleId: entrepriseId,
      details: { de: actuel, vers: cible, motif: motif ?? null },
    });
    return { id: entrepriseId, statut: cible };
  });
}
