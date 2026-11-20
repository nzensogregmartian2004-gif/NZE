// Notifications push : jetons des appareils et envoi des notifications restées sans push.
// Sans configuration Firebase, rien n'est envoyé ; les notifications restent consultables dans l'application.
// Une notification n'est marquée poussée qu'après un envoi réussi : un échec la laisse à réessayer.
import { and, asc, eq, gte, inArray, isNull } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import { appareilsPush, notifications } from '../../db/schema.ts';
import { log } from '../../core/logger.ts';

export interface MessagePush { titre: string; corps: string; donnees: Record<string, string> }
export interface ResultatEnvoi { invalides: string[] }
// Envoi réel : Firebase Cloud Messaging (voir firebase.ts). Remplaçable en test.
export interface EnvoyeurPush { envoyer(jetons: string[], message: MessagePush): Promise<ResultatEnvoi> }
export interface BilanPush { configure: boolean; traitees: number; envoyees: number; supprimes: number }

// Seules les notifications récentes sont poussées : un vieux stock non envoyé ne doit pas arriver en retard.
const FENETRE_MS = 24 * 60 * 60 * 1000;

export async function enregistrerAppareil(db: Db, userId: string, jeton: string, plateforme: string): Promise<void> {
  // Un jeton appartient à un seul compte : s'il change de main, il est rattaché au nouveau compte.
  await db
    .insert(appareilsPush)
    .values({ userId, jeton, plateforme, misAJourLe: new Date() })
    .onConflictDoUpdate({ target: appareilsPush.jeton, set: { userId, plateforme, misAJourLe: new Date() } });
}

export async function supprimerAppareil(db: Db, userId: string, jeton: string): Promise<void> {
  await db.delete(appareilsPush).where(and(eq(appareilsPush.jeton, jeton), eq(appareilsPush.userId, userId)));
}

export async function envoyerNotificationsEnAttente(db: Db, envoyeur: EnvoyeurPush | null, taille = 100): Promise<BilanPush> {
  if (!envoyeur) return { configure: false, traitees: 0, envoyees: 0, supprimes: 0 };
  const depuis = new Date(Date.now() - FENETRE_MS);
  const lot = await db
    .select()
    .from(notifications)
    .where(and(isNull(notifications.pousseeLe), gte(notifications.createdAt, depuis)))
    .orderBy(asc(notifications.createdAt))
    .limit(taille);

  let envoyees = 0;
  let supprimes = 0;
  for (const n of lot) {
    const appareils = await db.select({ jeton: appareilsPush.jeton }).from(appareilsPush).where(eq(appareilsPush.userId, n.destinataireId));
    if (appareils.length > 0) {
      try {
        const donnees: Record<string, string> = { type: n.type };
        if (n.cibleType) donnees.cibleType = n.cibleType;
        if (n.cibleId) donnees.cibleId = n.cibleId;
        const resultat = await envoyeur.envoyer(appareils.map((a) => a.jeton), { titre: n.titre, corps: n.message, donnees });
        if (resultat.invalides.length > 0) {
          await db.delete(appareilsPush).where(inArray(appareilsPush.jeton, resultat.invalides));
          supprimes += resultat.invalides.length;
        }
        envoyees += appareils.length - resultat.invalides.length;
      } catch {
        log('error', 'push_envoi_echec', { notification: n.id });
        continue; // non marquée : reprise au prochain passage
      }
    }
    await db.update(notifications).set({ pousseeLe: new Date() }).where(eq(notifications.id, n.id));
  }
  return { configure: true, traitees: lot.length, envoyees, supprimes };
}
