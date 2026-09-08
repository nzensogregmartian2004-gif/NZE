import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { requireActivity } from "../../middleware/activity.js";
import * as profilesController from "./service-profiles.controller.js";
import * as postsController from "../service-posts/service-posts.controller.js";

export const serviceProfilesRouter = Router();

// Lecture publique
serviceProfilesRouter.get("/", profilesController.listServiceProfiles);
serviceProfilesRouter.get(
  "/mine",
  requireAuth,
  requireActivity("prestataire"),
  profilesController.getMyServiceProfile
);
serviceProfilesRouter.get("/:id", profilesController.getServiceProfile);
serviceProfilesRouter.get("/:serviceProfileId/posts", postsController.listServicePosts);

// Écriture réservée à l'activité "prestataire" propriétaire
serviceProfilesRouter.post(
  "/",
  requireAuth,
  requireActivity("prestataire"),
  profilesController.createServiceProfile
);
serviceProfilesRouter.patch(
  "/:id",
  requireAuth,
  requireActivity("prestataire"),
  profilesController.updateServiceProfile
);
serviceProfilesRouter.post(
  "/:serviceProfileId/posts",
  requireAuth,
  requireActivity("prestataire"),
  postsController.createServicePost
);
