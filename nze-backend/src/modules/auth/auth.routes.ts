import { Router } from "express";
import * as authController from "./auth.controller.js";
import { authLimiter } from "../../middleware/rateLimit.js";

export const authRouter = Router();

authRouter.post("/register", authLimiter, authController.register);
authRouter.post("/otp/request", authLimiter, authController.requestOtp);
authRouter.post("/otp/verify", authLimiter, authController.verifyOtp);
authRouter.post("/login", authLimiter, authController.login);
authRouter.post("/refresh", authController.refresh);
