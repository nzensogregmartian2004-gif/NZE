import type { Request, Response, NextFunction } from "express";
import {
  registerSchema,
  loginSchema,
  otpVerifySchema,
  otpRequestSchema,
  refreshSchema,
} from "./auth.validation.js";
import * as authService from "./auth.service.js";

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const input = registerSchema.parse(req.body);
    const user = await authService.registerUser(input);
    res.status(201).json({
      message: "Compte créé. Un code de vérification a été envoyé par SMS.",
      userId: user.id,
    });
  } catch (err) {
    next(err);
  }
}

export async function requestOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const { telephone } = otpRequestSchema.parse(req.body);
    await authService.requestOtp(telephone);
    res.json({ message: "Code envoyé" });
  } catch (err) {
    next(err);
  }
}

export async function verifyOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const { telephone, code } = otpVerifySchema.parse(req.body);
    const tokens = await authService.verifyOtp(telephone, code);
    res.json(tokens);
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const input = loginSchema.parse(req.body);
    const tokens = await authService.loginUser(input);
    res.json(tokens);
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    const tokens = await authService.refreshAccessToken(refreshToken);
    res.json(tokens);
  } catch (err) {
    next(err);
  }
}
