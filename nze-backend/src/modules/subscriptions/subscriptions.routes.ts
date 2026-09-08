import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "../../db/index.js";
import { subscriptionPlans, subscriptions, userActivities } from "../../db/schema/index.js";
import { requireAuth, requireAdmin } from "../../middleware/auth.js";
import { AppError } from "../../middleware/errorHandler.js";
import { initiatePayment } from "../../lib/payment.js";
import { logAdminAction } from "../../lib/adminLog.js";

export const subscriptionPlansRouter = Router();

// Lecture publique des formules actives
subscriptionPlansRouter.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await db.query.subscriptionPlans.findMany({ where: eq(subscriptionPlans.actif, true) }));
  } catch (err) {
    next(err);
  }
});

const planSchema = z.object({
  nom: z.string().min(1).max(100),
  prix: z.number().nonnegative(),
  dureeJours: z.number().int().positive(),
  fonctionnalites: z.array(z.string()).optional(),
});

// Gestion admin des formules — point 28/29 : prix entièrement configurables, jamais en dur au frontend
subscriptionPlansRouter.post("/", requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = planSchema.parse(req.body);
    const [plan] = await db
      .insert(subscriptionPlans)
      .values({ ...input, prix: input.prix.toString() })
      .returning();
    await logAdminAction(req.auth!.userId, "subscription_plan.created", "plan", plan.id);
    res.status(201).json(plan);
  } catch (err) {
    next(err);
  }
});

subscriptionPlansRouter.patch("/:id", requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = planSchema.partial().parse(req.body);
    const plan = await db.query.subscriptionPlans.findFirst({ where: eq(subscriptionPlans.id, req.params.id) });
    if (!plan) throw new AppError(404, "Formule introuvable");

    const { prix, ...rest } = input;
    const [updated] = await db
      .update(subscriptionPlans)
      .set({ ...rest, ...(prix !== undefined ? { prix: prix.toString() } : {}) })
      .where(eq(subscriptionPlans.id, plan.id))
      .returning();

    await logAdminAction(req.auth!.userId, "subscription_plan.updated", "plan", plan.id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

subscriptionPlansRouter.patch(
  "/:id/deactivate",
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plan = await db.query.subscriptionPlans.findFirst({ where: eq(subscriptionPlans.id, req.params.id) });
      if (!plan) throw new AppError(404, "Formule introuvable");

      const [updated] = await db
        .update(subscriptionPlans)
        .set({ actif: false })
        .where(eq(subscriptionPlans.id, plan.id))
        .returning();

      await logAdminAction(req.auth!.userId, "subscription_plan.deactivated", "plan", plan.id);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// Abonnement d'une activité (magasin, prestataire...) à une formule
export const subscriptionsRouter = Router();
subscriptionsRouter.use(requireAuth);

const subscribeSchema = z.object({
  userActivityId: z.string().uuid(),
  planId: z.string().uuid(),
});

subscriptionsRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = subscribeSchema.parse(req.body);

    const activity = await db.query.userActivities.findFirst({
      where: and(eq(userActivities.id, input.userActivityId), eq(userActivities.userId, req.auth!.userId)),
    });
    if (!activity) throw new AppError(403, "Cette activité ne t'appartient pas");

    const plan = await db.query.subscriptionPlans.findFirst({ where: eq(subscriptionPlans.id, input.planId) });
    if (!plan || !plan.actif) throw new AppError(404, "Formule introuvable ou inactive");

    const payment = await initiatePayment(req.auth!.userId, Number(plan.prix), "abonnement", plan.id);
    if (payment.statut !== "reussi") {
      return res.status(202).json({ message: "Paiement en attente de confirmation", payment });
    }

    const expireLe = new Date(Date.now() + plan.dureeJours * 24 * 60 * 60 * 1000);
    const [subscription] = await db
      .insert(subscriptions)
      .values({ userActivityId: input.userActivityId, planId: plan.id, expireLe })
      .returning();

    res.status(201).json(subscription);
  } catch (err) {
    next(err);
  }
});

subscriptionsRouter.get("/mine/:userActivityId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth!.isAdmin) {
      const activity = await db.query.userActivities.findFirst({
        where: and(eq(userActivities.id, req.params.userActivityId), eq(userActivities.userId, req.auth!.userId)),
      });
      if (!activity) throw new AppError(403, "Accès non autorisé");
    }

    const results = await db.query.subscriptions.findMany({
      where: eq(subscriptions.userActivityId, req.params.userActivityId),
      orderBy: (s, { desc }) => [desc(s.creeLe)],
    });
    res.json(results);
  } catch (err) {
    next(err);
  }
});
