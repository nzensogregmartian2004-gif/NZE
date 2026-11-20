// Responsable et priorité des dossiers de support (révision 19, cahier §17.2).
// Règles : un responsable est toujours un administrateur NZE ; la priorité et le responsable ne sont jamais visibles du client.
import { eq, inArray } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { users } from '../db/schema.ts';
import { ADMIN_ROLES } from './auth.ts';
import { badRequest } from './errors.ts';
import type { Executeur } from '../modules/audit/service.ts';

export const PRIORITES = ['BASSE', 'NORMALE', 'HAUTE', 'URGENTE'] as const;
export type Priorite = (typeof PRIORITES)[number];

export async function verifierResponsable(executeur: Executeur, responsableId: string): Promise<void> {
  const [u] = await executeur.select({ role: users.role }).from(users).where(eq(users.id, responsableId)).limit(1);
  if (!u || !(ADMIN_ROLES as string[]).includes(u.role)) {
    throw badRequest('Le responsable doit être un administrateur NZE');
  }
}

export async function idsAdministrateurs(executeur: Executeur | Db): Promise<string[]> {
  const rows = await executeur.select({ id: users.id }).from(users).where(inArray(users.role, ADMIN_ROLES));
  return rows.map((r) => r.id);
}
