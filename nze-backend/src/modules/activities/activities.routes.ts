import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import * as activitiesController from "./activities.controller.js";

export const activitiesRouter = Router();

activitiesRouter.use(requireAuth);
activitiesRouter.get("/", activitiesController.listMyActivities);
activitiesRouter.post("/", activitiesController.createActivity);
activitiesRouter.patch("/:id", activitiesController.updateActivity);
activitiesRouter.delete("/:id", activitiesController.deactivateActivity);
