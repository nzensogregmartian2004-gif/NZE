import { eq, and, gt } from "drizzle-orm";
import { db } from "../../db/index.js";
import { users, otpCodes, refreshTokens } from "../../db/schema/index.js";
import { hashPassword, comparePassword } from "../../lib/password.js";
import { generateOtpCode, otpExpiryDate, sendOtpSms } from "../../lib/otp.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../lib/jwt.js";
import { AppError } from "../../middleware/errorHandler.js";
import type { registerSchema, loginSchema } from "./auth.validation.js";
import type { z } from "zod";

export async function registerUser(input: z.infer<typeof registerSchema>) {
  const existing = await db.query.users.findFirst({
    where: eq(users.telephone, input.telephone),
  });
  if (existing) {
    throw new AppError(409, "Un compte existe déjà avec ce numéro de téléphone");
  }

  const motDePasseHash = await hashPassword(input.motDePasse);

  const [user] = await db
    .insert(users)
    .values({
      nom: input.nom,
      prenom: input.prenom,
      telephone: input.telephone,
      email: input.email,
      motDePasseHash,
    })
    .returning();

  await requestOtp(user.telephone);

  return user;
}

export async function requestOtp(telephone: string) {
  const code = generateOtpCode();
  await db.insert(otpCodes).values({
    telephone,
    code,
    expireLe: otpExpiryDate(),
  });
  await sendOtpSms(telephone, code);
}

export async function verifyOtp(telephone: string, code: string) {
  const now = new Date();

  const record = await db.query.otpCodes.findFirst({
    where: and(
      eq(otpCodes.telephone, telephone),
      eq(otpCodes.code, code),
      eq(otpCodes.utilise, false),
      gt(otpCodes.expireLe, now)
    ),
  });

  if (!record) {
    throw new AppError(400, "Code OTP invalide ou expiré");
  }

  await db.update(otpCodes).set({ utilise: true }).where(eq(otpCodes.id, record.id));
  await db.update(users).set({ telephoneVerifie: true }).where(eq(users.telephone, telephone));

  const user = await db.query.users.findFirst({ where: eq(users.telephone, telephone) });
  if (!user) throw new AppError(404, "Utilisateur introuvable");

  return issueTokens(user.id, user.isAdmin);
}

export async function loginUser(input: z.infer<typeof loginSchema>) {
  const user = await db.query.users.findFirst({
    where: eq(users.telephone, input.telephone),
  });

  if (!user || !(await comparePassword(input.motDePasse, user.motDePasseHash))) {
    throw new AppError(401, "Téléphone ou mot de passe incorrect");
  }

  if (user.statut !== "actif") {
    throw new AppError(403, "Ce compte est suspendu ou supprimé");
  }

  if (!user.telephoneVerifie) {
    throw new AppError(403, "Numéro de téléphone non vérifié — un nouveau code a été envoyé");
  }

  return issueTokens(user.id, user.isAdmin);
}

export async function issueTokens(userId: string, isAdmin: boolean) {
  const accessToken = signAccessToken({ userId, isAdmin });
  const refreshToken = signRefreshToken(userId);

  await db.insert(refreshTokens).values({
    userId,
    tokenHash: refreshToken, // simplifié pour la V1 ; à hacher en prod si besoin d'audit
    expireLe: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  return { accessToken, refreshToken };
}

export async function refreshAccessToken(refreshToken: string) {
  let payload: { userId: string };
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError(401, "Refresh token invalide ou expiré");
  }

  const stored = await db.query.refreshTokens.findFirst({
    where: and(
      eq(refreshTokens.tokenHash, refreshToken),
      eq(refreshTokens.revoque, false)
    ),
  });
  if (!stored) {
    throw new AppError(401, "Session révoquée, reconnexion nécessaire");
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, payload.userId) });
  if (!user) throw new AppError(404, "Utilisateur introuvable");

  const accessToken = signAccessToken({ userId: user.id, isAdmin: user.isAdmin });
  return { accessToken };
}
