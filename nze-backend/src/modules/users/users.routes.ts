import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import * as usersController from "./users.controller.js";

export const usersRouter = Router();

usersRouter.use(requireAuth);
usersRouter.get("/me", usersController.getMe);
usersRouter.patch("/me", usersController.updateMe);
