// Notifications dans l'application (révision 12). L'envoi par SMS ou push viendra avec le fournisseur (étape 8).
// Règle : aucun code de remise, aucun secret, aucun numéro de carte n'est écrit dans un message.
import { and, count, desc, eq, isNull } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import { notifications, users } from '../../db/schema.ts';
import { notFound } from '../../core/errors.ts';
import type { Executeur } from '../audit/service.ts';
import { traduire, TEXTES, type LangueNotification, type Parametres } from './textes.ts';

export interface NotificationEntree {
  destinataireId: string;
  type: string;
  titre: string;
  message: string;
  cibleType?: string;
  cibleId?: string | null;
  // Clé du texte traduit (par défaut : le type). Permet de distinguer deux messages d'un même type.
  cle?: string;
  // Montants, dates et motifs : passés en paramètres pour que chaque langue les place correctement.
  parametres?: Parametres;
}

// Appelé dans la transaction de l'événement : la notification existe si et seulement si l'événement a eu lieu.
export async function notifier(executeur: Executeur, n: NotificationEntree): Promise<void> {
  const cle = n.cle ?? n.type;
  let titre = n.titre;
  let message = n.message;
  if (TEXTES[cle]) {
    // Langue du compte du destinataire ; le français est le repli.
    const [compte] = await executeur.select({ langue: users.langue }).from(users).where(eq(users.id, n.destinataireId)).limit(1);
    const traduit = traduire(cle, (compte?.langue ?? 'fr') as LangueNotification, n.parametres ?? {});
    if (traduit) { titre = traduit.titre; message = traduit.message; }
  }
  await executeur.insert(notifications).values({
    destinataireId: n.destinataireId,
    type: n.type,
    titre,
    message,
    cibleType: n.cibleType ?? null,
    cibleId: n.cibleId ?? null,
  });
}

export async function listerNotifications(db: Db, userId: string, limite: number, decalage = 0) {
  return db
    .select({
      id: notifications.id,
      type: notifications.type,
      titre: notifications.titre,
      message: notifications.message,
      cibleType: notifications.cibleType,
      cibleId: notifications.cibleId,
      lueLe: notifications.lueLe,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(eq(notifications.destinataireId, userId))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(limite)
    .offset(decalage);
}

export async function compterNonLues(db: Db, userId: string): Promise<{ nombre: number }> {
  const [{ nombre }] = await db
    .select({ nombre: count() })
    .from(notifications)
    .where(and(eq(notifications.destinataireId, userId), isNull(notifications.lueLe)));
  return { nombre };
}

// Un utilisateur ne marque que ses propres notifications. Relire une notification déjà lue ne change rien.
export async function marquerLue(db: Db, userId: string, id: string) {
  const [n] = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.id, id), eq(notifications.destinataireId, userId)))
    .limit(1);
  if (!n) throw notFound('Notification introuvable');
  if (!n.lueLe) {
    await db.update(notifications).set({ lueLe: new Date() }).where(eq(notifications.id, id));
  }
  return { id, lue: true };
}

export async function marquerToutesLues(db: Db, userId: string) {
  await db
    .update(notifications)
    .set({ lueLe: new Date() })
    .where(and(eq(notifications.destinataireId, userId), isNull(notifications.lueLe)));
  return { ok: true };
}
