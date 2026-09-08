import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "../../db/index.js";
import { verifiedJobs } from "../../db/schema/index.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireActivity } from "../../middleware/activity.js";
import { AppError } from "../../middleware/errorHandler.js";
import { ensureOwnedServiceProfile } from "../service-profiles/service-profiles.controller.js";

const createVerifiedJobSchema = z.object({
  serviceProfileId: z.string().uuid(),
  clientActivityId: z.string().uuid(),
  description: z.string().min(1).max(1000),
  datePrestation: z.string().date(),
});

export const verifiedJobsRouter = Router();
verifiedJobsRouter.use(requireAuth);

// Le prestataire déclare une prestation réalisée pour un client
verifiedJobsRouter.post(
  "/",
  requireActivity("prestataire"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = createVerifiedJobSchema.parse(req.body);
      await ensureOwnedServiceProfile(input.serviceProfileId, req.activity!.id);

      const [job] = await db
        .insert(verifiedJobs)
        .values({
          serviceProfileId: input.serviceProfileId,
          clientActivityId: input.clientActivityId,
          description: input.description,
          datePrestation: input.datePrestation,
        })
        .returning();

      res.status(201).json({
        ...job,
        message: "En attente de confirmation par le client",
      });
    } catch (err) {
      next(err);
    }
  }
);

// Le client confirme que la prestation a bien été réalisée
verifiedJobsRouter.patch(
  "/:id/confirm",
  requireActivity("client"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const job = await db.query.verifiedJobs.findFirst({ where: eq(verifiedJobs.id, req.params.id) });
      if (!job) throw new AppError(404, "Travail introuvable");
      if (job.clientActivityId !== req.activity!.id) {
        throw new AppError(403, "Seul le client concerné peut confirmer ce travail");
      }

      const [updated] = await db
        .update(verifiedJobs)
        .set({ statutConfirmation: "confirmee" })
        .where(eq(verifiedJobs.id, job.id))
        .returning();

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// Le client refuse (contestation)
verifiedJobsRouter.patch(
  "/:id/reject",
  requireActivity("client"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const job = await db.query.verifiedJobs.findFirst({ where: eq(verifiedJobs.id, req.params.id) });
      if (!job) throw new AppError(404, "Travail introuvable");
      if (job.clientActivityId !== req.activity!.id) {
        throw new AppError(403, "Seul le client concerné peut répondre à cette demande");
      }

      const [updated] = await db
        .update(verifiedJobs)
        .set({ statutConfirmation: "refusee" })
        .where(eq(verifiedJobs.id, job.id))
        .returning();

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);
