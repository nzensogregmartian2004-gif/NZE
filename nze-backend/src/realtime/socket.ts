import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { verifyAccessToken } from "../lib/jwt.js";
import { db } from "../db/index.js";
import { eq, and } from "drizzle-orm";
import { conversationParticipants, deliveries, deliverers, orders, userActivities } from "../db/schema/index.js";
import { env } from "../config/env.js";

let io: Server | null = null;

/**
 * Salles utilisées :
 * - `user:<userId>`        → notifications personnelles (toujours rejointe à la connexion)
 * - `conversation:<id>`    → messagerie, rejointe à la demande après vérification d'appartenance
 * - `deliverer:<id>`       → position live d'un livreur, rejointe par les clients qui suivent une livraison
 */
export function initSocket(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.CORS_ORIGIN },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error("Authentification requise"));
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.userId;
      next();
    } catch {
      next(new Error("Token invalide"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId: string = socket.data.userId;
    socket.join(`user:${userId}`);

    socket.on("conversation:join", async (conversationId: string) => {
      const participant = await db.query.conversationParticipants.findFirst({
        where: and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, userId)
        ),
      });
      if (participant) socket.join(`conversation:${conversationId}`);
    });

    socket.on("conversation:leave", (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // Un client rejoint la salle de suivi d'une livraison en cours (même vérification
    // d'accès que GET /deliveries/:id/tracking).
    socket.on("tracking:join", async (deliveryId: string) => {
      const delivery = await db.query.deliveries.findFirst({ where: eq(deliveries.id, deliveryId) });
      if (!delivery?.delivererId) return;

      let authorized = false;
      if (delivery.orderId) {
        const order = await db.query.orders.findFirst({ where: eq(orders.id, delivery.orderId) });
        if (order) {
          const clientActivity = await db.query.userActivities.findFirst({
            where: and(eq(userActivities.id, order.clientActivityId), eq(userActivities.userId, userId)),
          });
          authorized = Boolean(clientActivity);
        }
      }
      const delivererActivity = await db.query.userActivities.findFirst({
        where: and(eq(userActivities.userId, userId), eq(userActivities.type, "livreur")),
      });
      if (delivererActivity) {
        const deliverer = await db.query.deliverers.findFirst({
          where: eq(deliverers.userActivityId, delivererActivity.id),
        });
        if (deliverer?.id === delivery.delivererId) authorized = true;
      }

      if (authorized) socket.join(`deliverer:${delivery.delivererId}`);
    });

    // Symétrique à tracking:join : on accepte aussi bien un deliveryId qu'un
    // delivererId pour la déconnexion (le client peut connaître l'un ou l'autre).
    socket.on("tracking:leave", async (idOrDelivererId: string) => {
      const delivery = await db.query.deliveries.findFirst({ where: eq(deliveries.id, idOrDelivererId) });
      const delivererId = delivery?.delivererId ?? idOrDelivererId;
      socket.leave(`deliverer:${delivererId}`);
    });
  });

  return io;
}

export function getIo(): Server {
  if (!io) throw new Error("Socket.IO n'est pas initialisé — appelle initSocket() au démarrage du serveur");
  return io;
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
}

export function emitToConversation(conversationId: string, event: string, payload: unknown) {
  io?.to(`conversation:${conversationId}`).emit(event, payload);
}

export function emitToDelivererWatchers(delivererId: string, event: string, payload: unknown) {
  io?.to(`deliverer:${delivererId}`).emit(event, payload);
}
