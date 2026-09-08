import { Router } from "express";
import { requireAuth, requireAdmin } from "../../middleware/auth.js";
import * as deliveriesController from "./deliveries.controller.js";

export const deliveriesRouter = Router();

deliveriesRouter.use(requireAuth);

// Admin
deliveriesRouter.post("/", requireAdmin, deliveriesController.createManualDelivery);
deliveriesRouter.get("/pending", requireAdmin, deliveriesController.listPendingDeliveries);
deliveriesRouter.patch("/:id/assign", requireAdmin, deliveriesController.assignDeliverer);

// Livreur (propriété de la mission vérifiée dans le controller)
deliveriesRouter.get("/mine", deliveriesController.listMyDeliveries);
deliveriesRouter.patch("/:id/status", deliveriesController.updateDeliveryStatus);

// Client, livreur ou admin (autorisation vérifiée dans le controller)
deliveriesRouter.get("/:id/tracking", deliveriesController.getDeliveryTracking);
deliveriesRouter.get("/by-order/:orderId/tracking", deliveriesController.getDeliveryByOrder);
