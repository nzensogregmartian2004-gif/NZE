import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import * as postsController from "./service-posts.controller.js";

export const servicePostsRouter = Router();

servicePostsRouter.get("/:id", postsController.getServicePost);
servicePostsRouter.post("/:id/like", requireAuth, postsController.likePost);
servicePostsRouter.delete("/:id/like", requireAuth, postsController.unlikePost);
servicePostsRouter.get("/:id/comments", postsController.listComments);
servicePostsRouter.post("/:id/comments", requireAuth, postsController.addComment);
