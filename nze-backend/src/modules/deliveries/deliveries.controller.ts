import type { Request, Response, NextFunction } from "express";
import { eq, inArray, and } from "drizzle-orm";
import { db } from "../../db/index.js";
import { deliveries, deliverers, orders, locations, userActivities } from "../../db/schema/index.js";
import { createNotification } from "../notifications/notifications.service.js";
import { emitToDelivererWatchers } from "../../realtime/socket.js";
import { AppError } from "../../middleware/errorHandler.js";
import { findOwnDeliverer } from "../deliverers/deliverers.controller.js";
import {
  createManualDeliverySchema,
  assignDelivererSchema,
  updateDeliveryStatusSchema,
  LIVREUR_STATUS_SEQUENCE,
} from "./deliveries.validation.js";

export async function listMyDeliveries(req: Request, res: Response, next: NextFunction) {
  try {
    const deliverer = await findOwnDeliverer(req.auth!.userId);
    const results = await db.query.deliveries.findMany({
      where: eq(deliveries.delivererId, deliverer.id),
      orderBy: (d, { desc }) => [desc(d.majLe)],
    });
    res.json(results);
  } catch (err) {
    next(err);
  }
}

export async function createManualDelivery(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createManualDeliverySchema.parse(req.body);

    const [delivery] = await db
      .insert(deliveries)
      .values({
        statut: "nouvelle",
        positionDepartLatitude: input.positionDepart.latitude,
        positionDepartLongitude: input.positionDepart.longitude,
        positionClientLatitude: input.positionClient.latitude,
        positionClientLongitude: input.positionClient.longitude,
        typeLivraison: input.typeLivraison,
        description: input.description,
        remuneration: input.remuneration?.toString(),
        instructions: input.instructions,
      })
      .returning();

    res.status(201).json(delivery);
  } catch (err) {
    next(err);
  }
}

export async function listPendingDeliveries(_req: Request, res: Response, next: NextFunction) {
  try {
    const results = await db.query.deliveries.findMany({
      where: inArray(deliveries.statut, ["nouvelle", "en_attente", "livreur_recherche"]),
      orderBy: (d, { asc }) => [asc(d.creeLe)],
    });
    res.json(results);
  } catch (err) {
    next(err);
  }
}

export async function assignDeliverer(req: Request, res: Response, next: NextFunction) {
  try {
    const delivery = await db.query.deliveries.findFirst({ where: eq(deliveries.id, req.params.id) });
    if (!delivery) throw new AppError(404, "Mission introuvable");

    const { delivererId } = assignDelivererSchema.parse(req.body);
    const deliverer = await db.query.deliverers.findFirst({ where: eq(deliverers.id, delivererId) });
    if (!deliverer) throw new AppError(404, "Livreur introuvable");
    if (deliverer.statutValidation !== "valide") {
      throw new AppError(400, "Ce livreur n'est pas validé");
    }

    const [updated] = await db
      .update(deliveries)
      .set({ delivererId, statut: "livreur_attribue", majLe: new Date() })
      .where(eq(deliveries.id, delivery.id))
      .returning();

    const delivererUserId = (
      await db.query.userActivities.findFirst({ where: eq(userActivities.id, deliverer.userActivityId) })
    )?.userId;
    if (delivererUserId) {
      await createNotification(delivererUserId, "mission_recue", "Nouvelle mission de livraison reçue", {
        deliveryId: delivery.id,
      });
    }

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

async function assertOwnDelivery(deliveryId: string, userId: string) {
  const deliverer = await findOwnDeliverer(userId);
  const delivery = await db.query.deliveries.findFirst({ where: eq(deliveries.id, deliveryId) });
  if (!delivery) throw new AppError(404, "Mission introuvable");
  if (delivery.delivererId !== deliverer.id) {
    throw new AppError(403, "Cette mission ne t'est pas attribuée");
  }
  return { delivery, deliverer };
}

export async function updateDeliveryStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { delivery } = await assertOwnDelivery(req.params.id, req.auth!.userId);
    const { statut } = updateDeliveryStatusSchema.parse(req.body);

    if (statut === "annulee") {
      const [updated] = await db
        .update(deliveries)
        .set({ statut, majLe: new Date() })
        .where(eq(deliveries.id, delivery.id))
        .returning();
      return res.json(updated);
    }

    // La mission doit avoir été attribuée avant que le livreur puisse progresser.
    if (delivery.statut !== "livreur_attribue" && !LIVREUR_STATUS_SEQUENCE.includes(delivery.statut as any)) {
      throw new AppError(400, "Cette mission n'est pas encore attribuée");
    }

    const currentIndex =
      delivery.statut === "livreur_attribue"
        ? -1
        : LIVREUR_STATUS_SEQUENCE.indexOf(delivery.statut as (typeof LIVREUR_STATUS_SEQUENCE)[number]);
    const nextIndex = LIVREUR_STATUS_SEQUENCE.indexOf(statut as (typeof LIVREUR_STATUS_SEQUENCE)[number]);

    if (nextIndex !== currentIndex + 1) {
      throw new AppError(
        400,
        `Impossible de passer directement de "${delivery.statut}" à "${statut}" — les étapes doivent être suivies dans l'ordre`
      );
    }

    const [updated] = await db
      .update(deliveries)
      .set({ statut, majLe: new Date() })
      .where(eq(deliveries.id, delivery.id))
      .returning();

    if (statut === "livraison_terminee" && delivery.orderId) {
      await db.update(orders).set({ statut: "terminee", majLe: new Date() }).where(eq(orders.id, delivery.orderId));
    }

    if (delivery.orderId && (statut === "arrive_chez_client" || statut === "livraison_terminee")) {
      const order = await db.query.orders.findFirst({ where: eq(orders.id, delivery.orderId) });
      if (order) {
        const clientActivity = await db.query.userActivities.findFirst({
          where: eq(userActivities.id, order.clientActivityId),
        });
        if (clientActivity) {
          const message =
            statut === "arrive_chez_client" ? "Le livreur est arrivé" : "Ta livraison est terminée";
          await createNotification(clientActivity.userId, "livraison_statut", message, { deliveryId: delivery.id });
        }
      }
    }

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function getDeliveryByOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const delivery = await db.query.deliveries.findFirst({ where: eq(deliveries.orderId, req.params.orderId) });
    if (!delivery) throw new AppError(404, "Aucune livraison pour cette commande");
    req.params.id = delivery.id;
    return getDeliveryTracking(req, res, next);
  } catch (err) {
    next(err);
  }
}

export async function getDeliveryTracking(req: Request, res: Response, next: NextFunction) {
  try {
    const delivery = await db.query.deliveries.findFirst({ where: eq(deliveries.id, req.params.id) });
    if (!delivery) throw new AppError(404, "Mission introuvable");

    // Accès : admin, le livreur attribué, ou le client de la commande liée.
    let authorized = req.auth?.isAdmin ?? false;

    if (!authorized && delivery.delivererId) {
      const delivererActivity = await db.query.userActivities.findFirst({
        where: and(eq(userActivities.userId, req.auth!.userId), eq(userActivities.type, "livreur")),
      });
      const deliverer = delivererActivity
        ? await db.query.deliverers.findFirst({ where: eq(deliverers.userActivityId, delivererActivity.id) })
        : null;
      if (deliverer && delivery.delivererId === deliverer.id) authorized = true;
    }

    if (!authorized && delivery.orderId) {
      const order = await db.query.orders.findFirst({ where: eq(orders.id, delivery.orderId) });
      const clientActivity = order
        ? await db.query.userActivities.findFirst({
            where: and(eq(userActivities.id, order.clientActivityId), eq(userActivities.userId, req.auth!.userId)),
          })
        : null;
      if (clientActivity) authorized = true;
    }

    if (!authorized) throw new AppError(403, "Accès non autorisé à cette mission");

    let position = null;
    if (delivery.delivererId) {
      position = await db.query.locations.findFirst({
        where: eq(locations.entiteId, delivery.delivererId),
      });
    }

    res.json({
      id: delivery.id,
      statut: delivery.statut,
      positionLivreur: position ? { latitude: position.latitude, longitude: position.longitude } : null,
      positionDepart: {
        latitude: delivery.positionDepartLatitude,
        longitude: delivery.positionDepartLongitude,
      },
      positionClient: {
        latitude: delivery.positionClientLatitude,
        longitude: delivery.positionClientLongitude,
      },
    });
  } catch (err) {
    next(err);
  }
}
