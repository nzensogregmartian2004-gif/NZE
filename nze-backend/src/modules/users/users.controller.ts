import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { users, userActivities } from "../../db/schema/index.js";
import { AppError } from "../../middleware/errorHandler.js";
import { updateMeSchema } from "./users.validation.js";

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.auth!.userId),
      columns: {
        id: true,
        nom: true,
        prenom: true,
        telephone: true,
        telephoneVerifie: true,
        email: true,
        statut: true,
        isAdmin: true,
        creeLe: true,
      },
    });
    if (!user) throw new AppError(404, "Utilisateur introuvable");

    const activities = await db.query.userActivities.findMany({
      where: eq(userActivities.userId, req.auth!.userId),
    });

    res.json({ ...user, activities });
  } catch (err) {
    next(err);
  }
}

export async function updateMe(req: Request, res: Response, next: NextFunction) {
  try {
    const input = updateMeSchema.parse(req.body);
    const [updated] = await db
      .update(users)
      .set({ ...input, majLe: new Date() })
      .where(eq(users.id, req.auth!.userId))
      .returning();
    res.json(updated);
  } catch (err) {
    next(err);
  }
}
