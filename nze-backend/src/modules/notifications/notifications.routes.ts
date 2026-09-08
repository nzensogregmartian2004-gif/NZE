import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../../db/index.js";
import { notifications } from "../../db/schema/index.js";
import { requireAuth } from "../../middleware/auth.js";
import { AppError } from "../../middleware/errorHandler.js";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const results = await db.query.notifications.findMany({
      where: eq(notifications.userId, req.auth!.userId),
      orderBy: (n, { desc }) => [desc(n.creeLe)],
      limit: 100,
    });
    res.json(results);
  } catch (err) {
    next(err);
  }
});

notificationsRouter.patch("/:id/read", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notif = await db.query.notifications.findFirst({ where: eq(notifications.id, req.params.id) });
    if (!notif) throw new AppError(404, "Notification introuvable");
    if (notif.userId !== req.auth!.userId) throw new AppError(403, "Accès non autorisé");

    const [updated] = await db
      .update(notifications)
      .set({ lue: true })
      .where(eq(notifications.id, notif.id))
      .returning();
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

notificationsRouter.patch("/read-all", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await db
      .update(notifications)
      .set({ lue: true })
      .where(and(eq(notifications.userId, req.auth!.userId), eq(notifications.lue, false)));
    res.json({ message: "Toutes les notifications ont été marquées comme lues" });
  } catch (err) {
    next(err);
  }
});
