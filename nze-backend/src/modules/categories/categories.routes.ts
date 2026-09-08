import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../../db/index.js";
import { categories } from "../../db/schema/index.js";
import { requireAuth, requireAdmin } from "../../middleware/auth.js";

const createCategorySchema = z.object({
  nom: z.string().min(1).max(100),
  type: z.enum(["produit", "service"]),
});

export const categoriesRouter = Router();

categoriesRouter.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await db.select().from(categories));
  } catch (err) {
    next(err);
  }
});

categoriesRouter.post(
  "/",
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = createCategorySchema.parse(req.body);
      const [category] = await db.insert(categories).values(input).returning();
      res.status(201).json(category);
    } catch (err) {
      next(err);
    }
  }
);
