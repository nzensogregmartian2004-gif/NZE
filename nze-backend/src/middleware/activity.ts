import type { Request, Response, NextFunction } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { userActivities, type UserActivity } from "../db/schema/index.js";

declare global {
  namespace Express {
    interface Request {
      activity?: UserActivity;
    }
  }
}

/**
 * Vérifie que l'utilisateur authentifié possède une activité du type demandé,
 * avec le statut "active", et l'attache à req.activity.
 *
 * Ne fait AUCUNE confiance au frontend : le rôle est toujours revérifié en base.
 */
export function requireActivity(type: UserActivity["type"]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({ error: "Authentification requise" });
    }

    const [activity] = await db
      .select()
      .from(userActivities)
      .where(
        and(
          eq(userActivities.userId, req.auth.userId),
          eq(userActivities.type, type),
          eq(userActivities.statut, "active")
        )
      )
      .limit(1);

    if (!activity) {
      return res.status(403).json({
        error: `Activité "${type}" requise et active pour effectuer cette action`,
      });
    }

    req.activity = activity;
    next();
  };
}
