import type { Request, Response, NextFunction } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../../db/index.js";
import { userActivities } from "../../db/schema/index.js";
import { AppError } from "../../middleware/errorHandler.js";
import {
  createActivitySchema,
  updateActivitySchema,
  AUTO_VALIDATED_TYPES,
} from "./activities.validation.js";

export async function listMyActivities(req: Request, res: Response, next: NextFunction) {
  try {
    const activities = await db.query.userActivities.findMany({
      where: eq(userActivities.userId, req.auth!.userId),
    });
    res.json(activities);
  } catch (err) {
    next(err);
  }
}

export async function createActivity(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createActivitySchema.parse(req.body);

    const existing = await db.query.userActivities.findFirst({
      where: and(
        eq(userActivities.userId, req.auth!.userId),
        eq(userActivities.type, input.type)
      ),
    });
    if (existing) {
      throw new AppError(409, `Tu as déjà une activité "${input.type}" sur ce compte`);
    }

    const isAutoValidated = (AUTO_VALIDATED_TYPES as readonly string[]).includes(input.type);

    const [activity] = await db
      .insert(userActivities)
      .values({
        userId: req.auth!.userId,
        type: input.type,
        statut: isAutoValidated ? "active" : "en_attente",
        metadonnees: input.metadonnees ?? {},
      })
      .returning();

    res.status(201).json(activity);
  } catch (err) {
    next(err);
  }
}

export async function updateActivity(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const input = updateActivitySchema.parse(req.body);

    const activity = await db.query.userActivities.findFirst({
      where: and(eq(userActivities.id, id), eq(userActivities.userId, req.auth!.userId)),
    });
    if (!activity) throw new AppError(404, "Activité introuvable");

    const [updated] = await db
      .update(userActivities)
      .set({ metadonnees: input.metadonnees ?? activity.metadonnees, majLe: new Date() })
      .where(eq(userActivities.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function deactivateActivity(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const activity = await db.query.userActivities.findFirst({
      where: and(eq(userActivities.id, id), eq(userActivities.userId, req.auth!.userId)),
    });
    if (!activity) throw new AppError(404, "Activité introuvable");

    const [updated] = await db
      .update(userActivities)
      .set({ statut: "suspendue", majLe: new Date() })
      .where(eq(userActivities.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    next(err);
  }
}
