import { eq } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import { users } from '../../db/schema.ts';
import { hashMotDePasse } from '../../core/security.ts';
import { creerAdministrateur, normaliserTelephone } from './service.ts';

const ROLES_ADMIN = ['admin_principal', 'admin_secondaire'];
const LONGUEUR_MIN = 10;

// Définit le mot de passe d'un compte administrateur, ou crée le compte administrateur principal s'il n'existe pas.
// Ne modifie jamais un client, un commerçant ou un livreur.
export async function definirMotDePasseAdmin(db: Db, brut: string, motDePasse: string): Promise<'cree' | 'mis_a_jour'> {
  if (motDePasse.length < LONGUEUR_MIN) {
    throw new Error(`Le mot de passe doit comporter au moins ${LONGUEUR_MIN} caractères.`);
  }
  const telephone = normaliserTelephone(brut);
  const [existant] = await db.select().from(users).where(eq(users.telephone, telephone)).limit(1);
  if (existant && !ROLES_ADMIN.includes(existant.role)) {
    throw new Error('Ce numéro appartient à un compte qui n’est pas administrateur : rien n’a été modifié.');
  }
  if (!existant) await creerAdministrateur(db, telephone, 'admin_principal');
  await db.update(users).set({ motDePasseHash: await hashMotDePasse(motDePasse) }).where(eq(users.telephone, telephone));
  return existant ? 'mis_a_jour' : 'cree';
}
