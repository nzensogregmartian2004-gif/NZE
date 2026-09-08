import type { Request, Response, NextFunction } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../../db/index.js";
import { deliverers, userActivities, locations } from "../../db/schema/index.js";
import { AppError } from "../../middleware/errorHandler.js";
import { emitToDelivererWatchers } from "../../realtime/socket.js";
import {
  registerDelivererSchema,
  updateAvailabilitySchema,
  updateLocationSchema,
} from "./deliverers.validation.js";

/** Retrouve l'activité "livreur" de l'utilisateur connecté (quel que soit son statut). */
async function findOwnDelivererActivity(userId: string) {
  const activity = await db.query.userActivities.findFirst({
    where: and(eq(userActivities.userId, userId), eq(userActivities.type, "livreur")),
  });
  if (!activity) {
    throw new AppError(
      400,
      'Ajoute d\'abord une activité "livreur" via POST /users/me/activities avant de t\'enregistrer comme livreur'
    );
  }
  return activity;
}

export async function findOwnDeliverer(userId: string) {
  const activity = await findOwnDelivererActivity(userId);
  const deliverer = await db.query.deliverers.findFirst({
    where: eq(deliverers.userActivityId, activity.id),
  });
  if (!deliverer) throw new AppError(404, "Aucun profil livreur enregistré");
  return deliverer;
}

export async function registerDeliverer(req: Request, res: Response, next: NextFunction) {
  try {
    const activity = await findOwnDelivererActivity(req.auth!.userId);
    const input = registerDelivererSchema.parse(req.body);

    const existing = await db.query.deliverers.findFirst({
      where: eq(deliverers.userActivityId, activity.id),
    });
    if (existing) throw new AppError(409, "Profil livreur déjà enregistré");

    const [deliverer] = await db
      .insert(deliverers)
      .values({ ...input, userActivityId: activity.id })
      .returning();

    res.status(201).json({
      ...deliverer,
      message: "Profil livreur créé, en attente de validation par l'administration",
    });
  } catch (err) {
    next(err);
  }
}

export async function getMyDelivererProfile(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await findOwnDeliverer(req.auth!.userId));
  } catch (err) {
    next(err);
  }
}

export async function updateAvailability(req: Request, res: Response, next: NextFunction) {
  try {
    const deliverer = await findOwnDeliverer(req.auth!.userId);
    if (deliverer.statutValidation !== "valide") {
      throw new AppError(403, "Compte livreur pas encore validé par l'administration");
    }
    const { disponible } = updateAvailabilitySchema.parse(req.body);

    const [updated] = await db
      .update(deliverers)
      .set({ disponible, majLe: new Date() })
      .where(eq(deliverers.id, deliverer.id))
      .returning();

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function updateMyLocation(req: Request, res: Response, next: NextFunction) {
  try {
    const deliverer = await findOwnDeliverer(req.auth!.userId);
    const { latitude, longitude } = updateLocationSchema.parse(req.body);

    const existing = await db.query.locations.findFirst({
      where: and(eq(locations.entiteType, "livreur"), eq(locations.entiteId, deliverer.id)),
    });

    if (existing) {
      await db
        .update(locations)
        .set({ latitude, longitude, majLe: new Date() })
        .where(eq(locations.id, existing.id));
    } else {
      await db.insert(locations).values({
        entiteType: "livreur",
        entiteId: deliverer.id,
        latitude,
        longitude,
      });
    }

    emitToDelivererWatchers(deliverer.id, "location:update", { latitude, longitude });

    res.json({ message: "Position mise à jour" });
  } catch (err) {
    next(err);
  }
}
