// Commissions versionnées par entreprise. Une commande ne peut pas être créée sans commission définie.
import { and, desc, eq, isNull, lt, lte } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import { commissionsRegles } from '../../db/schema.ts';
import { badRequest, conflict } from '../../core/errors.ts';
import { journaliser } from '../audit/service.ts';

export async function tauxActif(db: Db, entrepriseId: string, a: Date = new Date()): Promise<number> {
  const [regle] = await db
    .select({ tauxBps: commissionsRegles.tauxBps })
    .from(commissionsRegles)
    .where(and(eq(commissionsRegles.entrepriseId, entrepriseId), lte(commissionsRegles.effetDebut, a)))
    .orderBy(desc(commissionsRegles.effetDebut))
    .limit(1);
  if (!regle) throw conflict("Commission non définie pour une entreprise partenaire de ce panier");
  return regle.tauxBps;
}

export interface AccordCommercial { conditions?: string | null; dureeMois?: number | null; documentUrl?: string | null }

export async function definirCommission(db: Db, entrepriseId: string, tauxBps: number, acteurId: string, effetDebut: Date = new Date(), accord: AccordCommercial = {}) {
  if (!Number.isInteger(tauxBps) || tauxBps < 0 || tauxBps > 10000) throw badRequest('Taux invalide : entier entre 0 et 10000 (points de base)');
  return db.transaction(async (tx) => {
    // Versionnement : l'accord précédent prend fin au moment où le nouveau entre en vigueur.
    await tx.update(commissionsRegles).set({ dateFin: effetDebut })
      .where(and(eq(commissionsRegles.entrepriseId, entrepriseId), isNull(commissionsRegles.dateFin), lt(commissionsRegles.effetDebut, effetDebut)));
    const [r] = await tx.insert(commissionsRegles).values({
      entrepriseId, tauxBps, effetDebut,
      conditions: accord.conditions ?? null, dureeMois: accord.dureeMois ?? null, documentUrl: accord.documentUrl ?? null,
    }).returning();
    await journaliser(tx, { acteurId, action: 'COMMISSION_DEFINIE', cibleType: 'entreprise', cibleId: entrepriseId, details: { tauxBps } });
    return r;
  });
}
