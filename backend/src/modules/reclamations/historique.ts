// Historique d'un dossier de réclamation (point de la liste restante) : toutes les actions journalisées sur ce dossier,
// dans l'ordre : création, notes internes, décision, clôture, alerte de retard.
import { and, asc, eq } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import { journalAudit, users } from '../../db/schema.ts';

export async function historiqueReclamation(db: Db, reclamationId: string) {
  return db
    .select({
      id: journalAudit.id,
      action: journalAudit.action,
      acteurId: journalAudit.acteurId,
      acteurNom: users.nomAffiche,
      details: journalAudit.details,
      creeLe: journalAudit.createdAt,
    })
    .from(journalAudit)
    .leftJoin(users, eq(users.id, journalAudit.acteurId))
    .where(and(eq(journalAudit.cibleType, 'reclamation'), eq(journalAudit.cibleId, reclamationId)))
    .orderBy(asc(journalAudit.createdAt))
    .limit(500);
}
