import type { Request, Response, NextFunction } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../../db/index.js";
import { rides, drivers } from "../../db/schema/index.js";
import { AppError } from "../../middleware/errorHandler.js";
import { findOwnDriver } from "../drivers/drivers.controller.js";
import { createRideSchema } from "./rides.validation.js";
import { haversineDistanceKm } from "../../lib/distance.js";
import { computeRidePriceFcfa } from "../../config/pricing.js";
import { createNotification, getUserIdForActivity } from "../notifications/notifications.service.js";

export async function createRide(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createRideSchema.parse(req.body);

    // Calcul automatique du prix : 2000 FCFA les 15 km (voir src/config/pricing.ts).
    const distanceKm = haversineDistanceKm(
      input.positionDepart.latitude,
      input.positionDepart.longitude,
      input.positionArrivee.latitude,
      input.positionArrivee.longitude
    );
    const prixEstime = computeRidePriceFcfa(distanceKm);

    const [ride] = await db
      .insert(rides)
      .values({
        clientActivityId: req.activity!.id,
        typeService: input.typeService,
        positionDepartLatitude: input.positionDepart.latitude,
        positionDepartLongitude: input.positionDepart.longitude,
        positionArriveeLatitude: input.positionArrivee.latitude,
        positionArriveeLongitude: input.positionArrivee.longitude,
        prixEstime: prixEstime.toString(),
      })
      .returning();

    res.status(201).json({ ...ride, distanceKm: Number(distanceKm.toFixed(2)) });
  } catch (err) {
    next(err);
  }
}

export async function listMyRides(req: Request, res: Response, next: NextFunction) {
  try {
    const results = await db.query.rides.findMany({
      where: eq(rides.clientActivityId, req.activity!.id),
      orderBy: (r, { desc }) => [desc(r.creeLe)],
    });
    res.json(results);
  } catch (err) {
    next(err);
  }
}

export async function listAvailableRides(req: Request, res: Response, next: NextFunction) {
  try {
    const driver = await findOwnDriver(req.auth!.userId);
    if (driver.statutValidation !== "valide") {
      throw new AppError(403, "Compte chauffeur pas encore validé");
    }

    const results = await db.query.rides.findMany({
      where: and(eq(rides.statut, "demandee"), eq(rides.typeService, driver.typeService)),
      orderBy: (r, { asc }) => [asc(r.creeLe)],
    });
    res.json(results);
  } catch (err) {
    next(err);
  }
}

export async function acceptRide(req: Request, res: Response, next: NextFunction) {
  try {
    const driver = await findOwnDriver(req.auth!.userId);
    if (driver.statutValidation !== "valide" || !driver.disponible) {
      throw new AppError(403, "Chauffeur non validé ou indisponible");
    }

    // Mise à jour conditionnelle pour éviter que deux chauffeurs acceptent la même course.
    const [updated] = await db
      .update(rides)
      .set({ driverId: driver.id, statut: "acceptee", majLe: new Date() })
      .where(and(eq(rides.id, req.params.id), eq(rides.statut, "demandee")))
      .returning();

    if (!updated) {
      throw new AppError(409, "Cette course n'est plus disponible");
    }

    const clientUserId = await getUserIdForActivity(updated.clientActivityId);
    if (clientUserId) {
      await createNotification(clientUserId, "course_acceptee", "Un chauffeur a accepté ta course", {
        rideId: updated.id,
      });
    }

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

async function assertOwnRide(rideId: string, userId: string) {
  const driver = await findOwnDriver(userId);
  const ride = await db.query.rides.findFirst({ where: eq(rides.id, rideId) });
  if (!ride) throw new AppError(404, "Course introuvable");
  if (ride.driverId !== driver.id) throw new AppError(403, "Cette course ne t'est pas attribuée");
  return ride;
}

export async function startRide(req: Request, res: Response, next: NextFunction) {
  try {
    const ride = await assertOwnRide(req.params.id, req.auth!.userId);
    if (ride.statut !== "acceptee") throw new AppError(400, "La course doit être acceptée avant de démarrer");

    const [updated] = await db
      .update(rides)
      .set({ statut: "en_cours", majLe: new Date() })
      .where(eq(rides.id, ride.id))
      .returning();
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function completeRide(req: Request, res: Response, next: NextFunction) {
  try {
    const ride = await assertOwnRide(req.params.id, req.auth!.userId);
    if (ride.statut !== "en_cours") throw new AppError(400, "La course doit être en cours pour être terminée");

    const [updated] = await db
      .update(rides)
      .set({ statut: "terminee", majLe: new Date() })
      .where(eq(rides.id, ride.id))
      .returning();
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function cancelRide(req: Request, res: Response, next: NextFunction) {
  try {
    const ride = await db.query.rides.findFirst({ where: eq(rides.id, req.params.id) });
    if (!ride) throw new AppError(404, "Course introuvable");
    if (ride.clientActivityId !== req.activity!.id) throw new AppError(403, "Accès non autorisé");
    if (!["demandee", "chauffeur_recherche", "acceptee"].includes(ride.statut)) {
      throw new AppError(400, "Cette course ne peut plus être annulée");
    }

    const [updated] = await db
      .update(rides)
      .set({ statut: "annulee", majLe: new Date() })
      .where(eq(rides.id, ride.id))
      .returning();
    res.json(updated);
  } catch (err) {
    next(err);
  }
}
