import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { requireActivity } from "../../middleware/activity.js";
import * as ridesController from "./rides.controller.js";

export const ridesRouter = Router();
ridesRouter.use(requireAuth);

// Client
ridesRouter.post("/", requireActivity("client"), ridesController.createRide);
ridesRouter.get("/me", requireActivity("client"), ridesController.listMyRides);
ridesRouter.patch("/:id/cancel", requireActivity("client"), ridesController.cancelRide);

// Chauffeur
ridesRouter.get("/available", ridesController.listAvailableRides);
ridesRouter.patch("/:id/accept", ridesController.acceptRide);
ridesRouter.patch("/:id/start", ridesController.startRide);
ridesRouter.patch("/:id/complete", ridesController.completeRide);
