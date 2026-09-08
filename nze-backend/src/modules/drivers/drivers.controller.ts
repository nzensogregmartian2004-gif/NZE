import type { Request, Response, NextFunction } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../../db/index.js";
import { drivers, userActivities } from "../../db/schema/index.js";
import { AppError } from "../../middleware/errorHandler.js";
import { registerDriverSchema, updateAvailabilitySchema } from "./drivers.validation.js";

async function findOwnDriverActivity(userId: string) {
  const activity = await db.query.userActivities.findFirst({
    where: and(eq(userActivities.userId, userId), eq(userActivities.type, "chauffeur")),
  });
  if (!activity) {
    throw new AppError(
      400,
      'Ajoute d\'abord une activité "chauffeur" via POST /users/me/activities avant de t\'enregistrer'
    );
  }
  return activity;
}

export async function findOwnDriver(userId: string) {
  const activity = await findOwnDriverActivity(userId);
  const driver = await db.query.drivers.findFirst({ where: eq(drivers.userActivityId, activity.id) });
  if (!driver) throw new AppError(404, "Aucun profil chauffeur enregistré");
  return driver;
}

export async function registerDriver(req: Request, res: Response, next: NextFunction) {
  try {
    const activity = await findOwnDriverActivity(req.auth!.userId);
    const input = registerDriverSchema.parse(req.body);

    const existing = await db.query.drivers.findFirst({ where: eq(drivers.userActivityId, activity.id) });
    if (existing) throw new AppError(409, "Profil chauffeur déjà enregistré");

    const [driver] = await db
      .insert(drivers)
      .values({ ...input, userActivityId: activity.id })
      .returning();

    res.status(201).json({ ...driver, message: "Profil créé, en attente de validation par l'administration" });
  } catch (err) {
    next(err);
  }
}

export async function getMyDriverProfile(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await findOwnDriver(req.auth!.userId));
  } catch (err) {
    next(err);
  }
}

export async function updateAvailability(req: Request, res: Response, next: NextFunction) {
  try {
    const driver = await findOwnDriver(req.auth!.userId);
    if (driver.statutValidation !== "valide") {
      throw new AppError(403, "Compte chauffeur pas encore validé par l'administration");
    }
    const { disponible } = updateAvailabilitySchema.parse(req.body);

    const [updated] = await db
      .update(drivers)
      .set({ disponible, majLe: new Date() })
      .where(eq(drivers.id, driver.id))
      .returning();

    res.json(updated);
  } catch (err) {
    next(err);
  }
}
