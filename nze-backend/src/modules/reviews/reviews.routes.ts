import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "../../db/index.js";
import { reviews, orders, stores, verifiedJobs, userActivities, serviceProfiles } from "../../db/schema/index.js";
import { requireAuth } from "../../middleware/auth.js";
import { AppError } from "../../middleware/errorHandler.js";

const createReviewSchema = z.object({
  cibleType: z.enum(["magasin", "produit", "prestataire", "livreur", "chauffeur", "vehicule"]),
  cibleId: z.string().uuid(),
  note: z.number().int().min(1).max(5),
  commentaire: z.string().max(1000).optional(),
});

/**
 * Détermine si l'auteur a une relation réelle et terminée avec la cible
 * (commande livrée pour un magasin, travail vérifié pour un prestataire...).
 * Les autres types de cibles (produit, livreur, chauffeur, vehicule) seront
 * raccrochés à une vérification équivalente au fur et à mesure des Phases 3/5.
 */
async function computeIsVerified(
  userId: string,
  cibleType: string,
  cibleId: string
): Promise<boolean> {
  const clientActivities = await db.query.userActivities.findMany({
    where: and(eq(userActivities.userId, userId), eq(userActivities.type, "client")),
  });
  const clientActivityIds = clientActivities.map((a) => a.id);
  if (clientActivityIds.length === 0) return false;

  if (cibleType === "magasin") {
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.storeId, cibleId), eq(orders.statut, "terminee")),
    });
    if (!order) return false;
    return clientActivityIds.includes(order.clientActivityId);
  }

  if (cibleType === "prestataire") {
    const profile = await db.query.serviceProfiles.findFirst({ where: eq(serviceProfiles.id, cibleId) });
    if (!profile) return false;
    const job = await db.query.verifiedJobs.findFirst({
      where: and(eq(verifiedJobs.serviceProfileId, profile.id), eq(verifiedJobs.statutConfirmation, "confirmee")),
    });
    return job ? clientActivityIds.includes(job.clientActivityId) : false;
  }

  return false;
}

export const reviewsRouter = Router();

reviewsRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cibleType = req.query.cibleType as string | undefined;
    const cibleId = req.query.cibleId as string | undefined;
    if (!cibleType || !cibleId) {
      throw new AppError(400, "cibleType et cibleId sont requis");
    }

    const results = await db.query.reviews.findMany({
      where: and(eq(reviews.cibleType, cibleType as any), eq(reviews.cibleId, cibleId)),
      orderBy: (r, { desc }) => [desc(r.creeLe)],
    });
    res.json(results);
  } catch (err) {
    next(err);
  }
});

reviewsRouter.post("/", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createReviewSchema.parse(req.body);

    if (input.cibleType === "magasin") {
      const store = await db.query.stores.findFirst({ where: eq(stores.id, input.cibleId) });
      if (!store) throw new AppError(404, "Cible introuvable");
    }

    const verifie = await computeIsVerified(req.auth!.userId, input.cibleType, input.cibleId);

    const [review] = await db
      .insert(reviews)
      .values({ ...input, auteurId: req.auth!.userId, verifie })
      .returning();

    res.status(201).json(review);
  } catch (err) {
    next(err);
  }
});
