import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../../db/index.js";
import { reports } from "../../db/schema/index.js";
import { requireAuth } from "../../middleware/auth.js";

const createReportSchema = z.object({
  cibleType: z.string().min(1).max(50),
  cibleId: z.string().uuid(),
  motif: z.string().min(1).max(1000),
});

export const reportsRouter = Router();

reportsRouter.post("/", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createReportSchema.parse(req.body);
    const [report] = await db
      .insert(reports)
      .values({ ...input, auteurId: req.auth!.userId })
      .returning();
    res.status(201).json(report);
  } catch (err) {
    next(err);
  }
});
