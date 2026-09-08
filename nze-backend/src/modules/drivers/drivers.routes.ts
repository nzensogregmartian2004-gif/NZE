import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import * as driversController from "./drivers.controller.js";

export const driversRouter = Router();

driversRouter.use(requireAuth);
driversRouter.post("/register", driversController.registerDriver);
driversRouter.get("/me", driversController.getMyDriverProfile);
driversRouter.patch("/me/availability", driversController.updateAvailability);
