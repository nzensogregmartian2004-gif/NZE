import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { requireActivity } from "../../middleware/activity.js";
import * as productsController from "./products.controller.js";

export const productsRouter = Router();

productsRouter.get("/:id", productsController.getProduct);
productsRouter.patch("/:id", requireAuth, requireActivity("commercant"), productsController.updateProduct);
productsRouter.delete("/:id", requireAuth, requireActivity("commercant"), productsController.deleteProduct);
