// Journal d'audit : trace les connexions, changements de droits, actions financières et actions de stock.
// Règle : aucun secret, mot de passe, code OTP ou jeton n'est écrit. Une clé interdite fait échouer l'écriture.
import { and, desc, eq, type SQL } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import { journalAudit } from '../../db/schema.ts';

// Exécuteur : la base elle-même, ou une transaction en cours (l'écriture suit alors le sort de l'opération).
export type Executeur = Db | Parameters<Parameters<Db['transaction']>[0]>[0];
export type ValeurJournal = string | number | boolean | null;

export interface EntreeJournal {
  acteurId: string | null;
  action: string;
  cibleType: string;
  cibleId: string | null;
  details?: Record<string, ValeurJournal>;
}

const CLES_INTERDITES = /password|mot_?de_?passe|secret|token|jeton|otp|cvv|pin/i;

export async function journaliser(executeur: Executeur, entree: EntreeJournal): Promise<void> {
  const details = entree.details ?? {};
  for (const cle of Object.keys(details)) {
    if (CLES_INTERDITES.test(cle)) throw new Error(`Clé interdite dans le journal d'audit : ${cle}`);
  }
  await executeur.insert(journalAudit).values({
    acteurId: entree.acteurId,
    action: entree.action,
    cibleType: entree.cibleType,
    cibleId: entree.cibleId,
    details,
  });
}

export async function listerJournal(db: Db, filtres: { action?: string; cibleId?: string; limite: number; decalage?: number }) {
  const conditions: SQL[] = [];
  if (filtres.action) conditions.push(eq(journalAudit.action, filtres.action));
  if (filtres.cibleId) conditions.push(eq(journalAudit.cibleId, filtres.cibleId));
  return db
    .select()
    .from(journalAudit)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(journalAudit.createdAt), desc(journalAudit.id))
    .limit(filtres.limite)
    .offset(filtres.decalage ?? 0);
}
