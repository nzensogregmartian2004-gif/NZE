import type { Request, Response, NextFunction } from "express";
import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { conversations, conversationParticipants, messages } from "../../db/schema/index.js";
import { AppError } from "../../middleware/errorHandler.js";
import { emitToConversation } from "../../realtime/socket.js";
import { createNotification } from "../notifications/notifications.service.js";
import { createConversationSchema, sendMessageSchema } from "./messaging.validation.js";

async function assertParticipant(conversationId: string, userId: string) {
  const participant = await db.query.conversationParticipants.findFirst({
    where: and(eq(conversationParticipants.conversationId, conversationId), eq(conversationParticipants.userId, userId)),
  });
  if (!participant) throw new AppError(403, "Tu ne fais pas partie de cette conversation");
}

export async function createConversation(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createConversationSchema.parse(req.body);
    const participantIds = Array.from(new Set([req.auth!.userId, ...input.participantUserIds]));

    // Réutilise une conversation directe existante avec exactement les mêmes participants,
    // pour éviter de multiplier les fils entre les deux mêmes personnes.
    if (participantIds.length === 2) {
      const existing = await db
        .select({ conversationId: conversationParticipants.conversationId })
        .from(conversationParticipants)
        .where(inArray(conversationParticipants.userId, participantIds))
        .groupBy(conversationParticipants.conversationId)
        .having(sql`count(*) = 2`);

      for (const row of existing) {
        const allParticipants = await db.query.conversationParticipants.findMany({
          where: eq(conversationParticipants.conversationId, row.conversationId),
        });
        if (allParticipants.length === 2) {
          const conversation = await db.query.conversations.findFirst({
            where: eq(conversations.id, row.conversationId),
          });
          return res.json(conversation);
        }
      }
    }

    const [conversation] = await db.insert(conversations).values({}).returning();
    await db
      .insert(conversationParticipants)
      .values(participantIds.map((userId) => ({ conversationId: conversation.id, userId })));

    res.status(201).json(conversation);
  } catch (err) {
    next(err);
  }
}

export async function listMyConversations(req: Request, res: Response, next: NextFunction) {
  try {
    const myParticipations = await db.query.conversationParticipants.findMany({
      where: eq(conversationParticipants.userId, req.auth!.userId),
    });
    const conversationIds = myParticipations.map((p) => p.conversationId);
    if (conversationIds.length === 0) return res.json([]);

    const results = await db.query.conversations.findMany({
      where: inArray(conversations.id, conversationIds),
      orderBy: (c, { desc }) => [desc(c.creeLe)],
    });
    res.json(results);
  } catch (err) {
    next(err);
  }
}

export async function listMessages(req: Request, res: Response, next: NextFunction) {
  try {
    await assertParticipant(req.params.id, req.auth!.userId);
    const results = await db.query.messages.findMany({
      where: eq(messages.conversationId, req.params.id),
      orderBy: (m, { asc }) => [asc(m.envoyeLe)],
      limit: 200,
    });
    res.json(results);
  } catch (err) {
    next(err);
  }
}

export async function sendMessage(req: Request, res: Response, next: NextFunction) {
  try {
    await assertParticipant(req.params.id, req.auth!.userId);
    const { contenu } = sendMessageSchema.parse(req.body);

    const [message] = await db
      .insert(messages)
      .values({ conversationId: req.params.id, senderId: req.auth!.userId, contenu })
      .returning();

    emitToConversation(req.params.id, "message:new", message);

    // Notification pour les autres participants (utile s'ils ne sont pas connectés au socket).
    const otherParticipants = await db.query.conversationParticipants.findMany({
      where: eq(conversationParticipants.conversationId, req.params.id),
    });
    await Promise.all(
      otherParticipants
        .filter((p) => p.userId !== req.auth!.userId)
        .map((p) =>
          createNotification(p.userId, "message_recu", "Nouveau message reçu", {
            conversationId: req.params.id,
          })
        )
    );

    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
}
