import type { Page } from '../../core/pagination.ts';
// Messagerie client-NZE. Chaque conversation peut être liée à un article, avec sa date.
// Suppression par le client (décision O-11) : définitive si la conversation n'est liée à aucune réclamation ;
// sinon elle est masquée pour le client et archivée pour les administrateurs (cahier V3.0 §17.1).
import { and, asc, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import { conversations, messages, produits, reclamations, users } from '../../db/schema.ts';
import { badRequest, forbidden, notFound } from '../../core/errors.ts';
import { ADMIN_ROLES, type AuthUser } from '../../core/auth.ts';
import { notifier } from '../notifications/service.ts';

export interface NouveauMessage {
  genre: 'TEXTE' | 'PHOTO' | 'VIDEO' | 'VOCAL';
  corps?: string;
  fichierCle?: string;
  dureeSec?: number;
}

const estAdmin = (user: AuthUser): boolean => (ADMIN_ROLES as readonly string[]).includes(user.role);

export async function ouvrirConversation(db: Db, user: AuthUser, produitId?: string) {
  if (produitId) {
    const [p] = await db.select({ id: produits.id }).from(produits).where(eq(produits.id, produitId)).limit(1);
    if (!p) throw notFound('Article introuvable');
  }
  const condition = produitId ? eq(conversations.produitId, produitId) : isNull(conversations.produitId);
  const [existante] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.userId, user.id), condition, isNull(conversations.masqueePourClientLe)))
    .limit(1);
  if (existante) return existante;
  const [c] = await db.insert(conversations).values({ userId: user.id, produitId: produitId ?? null }).returning();
  return c;
}

export async function listerConversations(db: Db, user: AuthUser) {
  return db
    .select()
    .from(conversations)
    .where(and(eq(conversations.userId, user.id), isNull(conversations.masqueePourClientLe)));
}

// Le client voit sa conversation ; un administrateur peut la lire et y répondre ; un autre client n'y accède pas.
async function verifierAcces(db: Db, user: AuthUser, conversationId: string) {
  const [c] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
  if (!c) throw notFound('Conversation introuvable');
  if (estAdmin(user)) return c;
  if (c.userId !== user.id) throw forbidden();
  if (c.masqueePourClientLe) throw notFound('Conversation introuvable');
  return c;
}

// Le client supprime sa conversation. Liée à une réclamation : masquée pour lui, archivée pour NZE.
export async function supprimerConversation(db: Db, user: AuthUser, conversationId: string): Promise<{ archivee: boolean }> {
  const c = await verifierAcces(db, user, conversationId);
  if (c.userId !== user.id) throw forbidden();
  const [lien] = c.produitId
    ? await db
        .select({ id: reclamations.id })
        .from(reclamations)
        .where(and(eq(reclamations.clientId, user.id), eq(reclamations.produitId, c.produitId)))
        .limit(1)
    : [];
  if (lien) {
    await db.update(conversations).set({ masqueePourClientLe: new Date(), archiveeLe: new Date() }).where(eq(conversations.id, conversationId));
    return { archivee: true };
  }
  await db.transaction(async (tx) => {
    await tx.delete(messages).where(eq(messages.conversationId, conversationId));
    await tx.delete(conversations).where(eq(conversations.id, conversationId));
  });
  return { archivee: false };
}

// Pagination depuis la fin : la page contient les messages les plus récents, renvoyés dans l'ordre chronologique.
async function pageDeMessages(db: Db, conversationId: string, page: Page) {
  const lot = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(page.limite)
    .offset(page.decalage);
  return lot.reverse();
}

export async function lireMessages(db: Db, user: AuthUser, conversationId: string, page: Page) {
  await verifierAcces(db, user, conversationId);
  return pageDeMessages(db, conversationId, page);
}

export async function envoyerMessage(db: Db, user: AuthUser, conversationId: string, m: NouveauMessage) {
  const c = await verifierAcces(db, user, conversationId);
  if (m.genre === 'TEXTE') {
    if (!m.corps || m.corps.trim().length === 0 || m.corps.length > 2000) throw badRequest('Message texte invalide (1 à 2000 caractères)');
  } else {
    if (!m.fichierCle) throw badRequest('Fichier requis pour ce type de message');
    if (m.genre === 'VOCAL' && (m.dureeSec ?? 0) > 120) throw badRequest('Message vocal limité à 2 minutes');
    if (m.genre === 'VIDEO' && (m.dureeSec ?? 0) > 60) throw badRequest('Vidéo limitée à 60 secondes');
  }
  const [msg] = await db
    .insert(messages)
    .values({ conversationId, expediteurId: user.id, genre: m.genre, corps: m.corps ?? null, fichierCle: m.fichierCle ?? null, dureeSec: m.dureeSec ?? null })
    .returning();
  // Réponse de NZE : le client est prévenu, sauf s'il a désactivé les alertes de messagerie.
  if (c.userId !== user.id) {
    const [client] = await db.select({ actives: users.notifMessagesActives }).from(users).where(eq(users.id, c.userId)).limit(1);
    if (client?.actives) {
      await notifier(db, { destinataireId: c.userId, type: 'MESSAGE_RECU', titre: 'Nouveau message', message: 'NZE vous a écrit au sujet de votre article.' });
    }
  }
  return msg;
}

// Administration : conversations archivées (liées à une réclamation ou à un litige).
export async function listerConversationsArchivees(db: Db, page: Page) {
  return db
    .select({
      id: conversations.id, userId: conversations.userId, produitId: conversations.produitId,
      nomProduit: produits.nom, archiveeLe: conversations.archiveeLe,
    })
    .from(conversations)
    .leftJoin(produits, eq(produits.id, conversations.produitId))
    .where(isNotNull(conversations.archiveeLe))
    .orderBy(desc(conversations.archiveeLe), desc(conversations.id))
    .limit(page.limite)
    .offset(page.decalage);
}

export async function lireConversationArchivee(db: Db, conversationId: string, page: Page) {
  const [c] = await db.select({ id: conversations.id, archiveeLe: conversations.archiveeLe }).from(conversations).where(eq(conversations.id, conversationId)).limit(1);
  if (!c || !c.archiveeLe) throw notFound('Conversation archivée introuvable');
  return pageDeMessages(db, conversationId, page);
}

// Réglages de messagerie (cahier V3.0 §17.1).
export async function lirePreferences(db: Db, user: AuthUser) {
  const [u] = await db.select({ actives: users.notifMessagesActives }).from(users).where(eq(users.id, user.id)).limit(1);
  return { notifMessages: u?.actives ?? true };
}

export async function majPreferences(db: Db, user: AuthUser, notifMessages: boolean) {
  await db.update(users).set({ notifMessagesActives: notifMessages }).where(eq(users.id, user.id));
  return { notifMessages };
}
