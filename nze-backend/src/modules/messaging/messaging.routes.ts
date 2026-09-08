import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import * as messagingController from "./messaging.controller.js";

export const conversationsRouter = Router();
conversationsRouter.use(requireAuth);

conversationsRouter.post("/", messagingController.createConversation);
conversationsRouter.get("/", messagingController.listMyConversations);
conversationsRouter.get("/:id/messages", messagingController.listMessages);
conversationsRouter.post("/:id/messages", messagingController.sendMessage);
