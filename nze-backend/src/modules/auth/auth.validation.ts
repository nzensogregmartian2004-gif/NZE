import { z } from "zod";

export const registerSchema = z.object({
  nom: z.string().min(1).max(100),
  prenom: z.string().min(1).max(100),
  telephone: z.string().min(8).max(20),
  email: z.string().email().optional(),
  motDePasse: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
});

export const loginSchema = z.object({
  telephone: z.string().min(8).max(20),
  motDePasse: z.string().min(1),
});

export const otpVerifySchema = z.object({
  telephone: z.string().min(8).max(20),
  code: z.string().min(4).max(10),
});

export const otpRequestSchema = z.object({
  telephone: z.string().min(8).max(20),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});
