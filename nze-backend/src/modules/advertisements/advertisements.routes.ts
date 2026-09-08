import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "../../db/index.js";
import { advertisements, stores, serviceProfiles, vehicles, products, userActivities } from "../../db/schema/index.js";
import { requireAuth, requireAdmin } from "../../middleware/auth.js";
import { AppError } from "../../middleware/errorHandler.js";
import { initiatePayment } from "../../lib/payment.js";
import { logAdminAction } from "../../lib/adminLog.js";

const createAdSchema = z.object({
  cibleType: z.enum(["produit", "magasin", "prestataire", "vehicule"]),
  cibleId: z.string().uuid(),
  emplacement: z.string().max(100).optional(),
  dateDebut: z.string().date(),
  dateFin: z.string().date(),
  prix: z.number().positive(),
});

/** Vérifie que la cible de la publicité appartient bien à une activité de l'utilisateur connecté. */
async function ensureOwnsTarget(userId: string, cibleType: string, cibleId: string) {
  const activities = await db.query.userActivities.findMany({ where: eq(userActivities.userId, userId) });
  const activityIds = new Set(activities.map((a) => a.id));

  if (cibleType === "produit") {
    const product = await db.query.products.findFirst({ where: eq(products.id, cibleId) });
    if (!product) throw new AppError(404, "Produit introuvable");
    const store = await db.query.stores.findFirst({ where: eq(stores.id, product.storeId) });
    if (!store || !activityIds.has(store.userActivityId)) throw new AppError(403, "Ce produit ne t'appartient pas");
    return;
  }
  if (cibleType === "magasin") {
    const store = await db.query.stores.findFirst({ where: eq(stores.id, cibleId) });
    if (!store) throw new AppError(404, "Magasin introuvable");
    if (!activityIds.has(store.userActivityId)) throw new AppError(403, "Ce magasin ne t'appartient pas");
    return;
  }
  if (cibleType === "prestataire") {
    const profile = await db.query.serviceProfiles.findFirst({ where: eq(serviceProfiles.id, cibleId) });
    if (!profile) throw new AppError(404, "Profil prestataire introuvable");
    if (!activityIds.has(profile.userActivityId)) throw new AppError(403, "Ce profil ne t'appartient pas");
    return;
  }
  if (cibleType === "vehicule") {
    const vehicle = await db.query.vehicles.findFirst({ where: eq(vehicles.id, cibleId) });
    if (!vehicle) throw new AppError(404, "Véhicule introuvable");
    if (!activityIds.has(vehicle.userActivityId)) throw new AppError(403, "Ce véhicule ne t'appartient pas");
    return;
  }
  throw new AppError(400, "Type de cible inconnu");
}

export const advertisementsRouter = Router();

// Lecture publique des publicités actives (pour mettre en avant dans le frontend)
advertisementsRouter.get("/active", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const emplacement = req.query.emplacement as string | undefined;
    const conditions = [eq(advertisements.statut, "active")];
    if (emplacement) conditions.push(eq(advertisements.emplacement, emplacement));

    res.json(await db.select().from(advertisements).where(and(...conditions)).limit(50));
  } catch (err) {
    next(err);
  }
});

advertisementsRouter.post("/", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createAdSchema.parse(req.body);
    await ensureOwnsTarget(req.auth!.userId, input.cibleType, input.cibleId);

    const payment = await initiatePayment(req.auth!.userId, input.prix, "publicite");
    if (payment.statut !== "reussi") {
      return res.status(202).json({ message: "Paiement en attente de confirmation", payment });
    }

    const [ad] = await db
      .insert(advertisements)
      .values({
        cibleType: input.cibleType,
        cibleId: input.cibleId,
        emplacement: input.emplacement,
        dateDebut: input.dateDebut,
        dateFin: input.dateFin,
        prix: input.prix.toString(),
      })
      .returning();

    res.status(201).json({ ...ad, message: "Publicité créée, en attente de validation par l'administration" });
  } catch (err) {
    next(err);
  }
});

advertisementsRouter.get(
  "/pending",
  requireAuth,
  requireAdmin,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await db.query.advertisements.findMany({ where: eq(advertisements.statut, "en_attente") }));
    } catch (err) {
      next(err);
    }
  }
);

const validateAdSchema = z.object({ statut: z.enum(["active", "refusee"]) });

advertisementsRouter.patch(
  "/:id/validate",
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { statut } = validateAdSchema.parse(req.body);
      const ad = await db.query.advertisements.findFirst({ where: eq(advertisements.id, req.params.id) });
      if (!ad) throw new AppError(404, "Publicité introuvable");

      const [updated] = await db
        .update(advertisements)
        .set({ statut })
        .where(eq(advertisements.id, ad.id))
        .returning();

      await logAdminAction(req.auth!.userId, `advertisement.${statut}`, ad.cibleType, ad.cibleId);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);
