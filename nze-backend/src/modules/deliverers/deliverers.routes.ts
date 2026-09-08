import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import * as delivererController from "./deliverers.controller.js";

export const deliverersRouter = Router();

deliverersRouter.use(requireAuth);
deliverersRouter.post("/register", delivererController.registerDeliverer);
deliverersRouter.get("/me", delivererController.getMyDelivererProfile);
deliverersRouter.patch("/me/availability", delivererController.updateAvailability);
deliverersRouter.post("/me/location", delivererController.updateMyLocation);
