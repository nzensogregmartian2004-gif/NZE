import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { requireActivity } from "../../middleware/activity.js";
import * as ordersController from "./orders.controller.js";

export const ordersRouter = Router();

ordersRouter.use(requireAuth);
ordersRouter.post("/", requireActivity("client"), ordersController.createOrder);
ordersRouter.get("/me", requireActivity("client"), ordersController.listMyOrders);
ordersRouter.get("/:id", ordersController.getOrder);
ordersRouter.patch("/:id/status", ordersController.updateOrderStatus);
